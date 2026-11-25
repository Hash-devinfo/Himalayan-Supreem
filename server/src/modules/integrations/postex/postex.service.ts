import mongoose, { isValidObjectId } from 'mongoose';
import City from '../../../models/City.js';
import IntegrationLog from '../../../models/IntegrationLog.js';
import Setting, { SETTINGS_ID } from '../../../models/Setting.js';
import { isPostexConfigured, postexMode, postexRequest, yes } from '../../../providers/couriers/postex/postexClient.js';
import AppError from '../../../utils/AppError.js';
import { recordAudit, type ActorContext } from '../../audit/audit.service.js';
import { getSettings } from '../../settings/settings.service.js';
import type { IntegrationLogQuery, MatchCityInput, PostexSettingsInput } from './postex.validation.js';

// Phase 20A: connection, pickup addresses and city matching for the PostEx API.
export const POSTEX_PATHS = {
  operationalCities: '/services/integration/api/order/v2/get-operational-city',
  merchantAddresses: '/services/integration/api/order/v1/get-merchant-address',
} as const;

export interface PostexCity {
  name: string;
  pickup: boolean;
  delivery: boolean;
}

export interface PostexAddress {
  addressCode: string;
  addressType: string;
  cityName: string;
  address: string;
  contactPersonName?: string;
}

// "Rahim Yar Khan" and "RAHIM YAR KHAN" and "Rahim-Yar-Khan" are the same city
export function cityKey(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

export async function fetchPostexCities(): Promise<PostexCity[]> {
  const result = await postexRequest<{ operationalCityName?: string; isPickupCity?: unknown; isDeliveryCity?: unknown }[]>({
    method: 'GET',
    path: POSTEX_PATHS.operationalCities,
    action: 'get_cities',
    summary: 'all cities',
  });
  return (Array.isArray(result.dist) ? result.dist : [])
    .filter((c) => c.operationalCityName)
    .map((c) => ({ name: String(c.operationalCityName).trim(), pickup: yes(c.isPickupCity), delivery: yes(c.isDeliveryCity) }));
}

export async function fetchPostexAddresses(): Promise<PostexAddress[]> {
  const result = await postexRequest<{ addressCode?: string; addressType?: string; cityName?: string; address?: string; contactPersonName?: string }[]>({
    method: 'GET',
    path: POSTEX_PATHS.merchantAddresses,
    action: 'get_addresses',
  });
  return (Array.isArray(result.dist) ? result.dist : [])
    .filter((a) => a.addressCode)
    .map((a) => ({
      addressCode: String(a.addressCode),
      addressType: a.addressType ?? '',
      cityName: a.cityName ?? '',
      address: a.address ?? '',
      contactPersonName: a.contactPersonName,
    }));
}

// ── Status and connection check ───────────────────────

export async function postexStatus() {
  const settings = await getSettings();
  const lastCheckFilter: Record<string, unknown> = { provider: 'postex', action: mongoose.trusted({ $in: ['check_connection', 'get_cities', 'get_addresses'] }) };
  const [lastCall, citiesServed, citiesChecked] = await Promise.all([
    IntegrationLog.findOne(lastCheckFilter).sort({ createdAt: -1 }).lean(),
    City.countDocuments({ 'postex.delivers': true }),
    City.countDocuments({ 'postex.checkedAt': mongoose.trusted({ $exists: true }) }),
  ]);
  return {
    configured: isPostexConfigured(),
    mode: postexMode(), // "live" = real bookings, "uat" = PostEx test server
    pickupAddressCode: settings.postex?.pickupAddressCode ?? null,
    returnAddressCode: settings.postex?.returnAddressCode ?? null,
    citiesServed,
    citiesChecked,
    lastCall: lastCall ? { action: lastCall.action, status: lastCall.status, at: lastCall.createdAt, error: lastCall.error } : null,
    readyToBook: isPostexConfigured() && Boolean(settings.postex?.pickupAddressCode) && citiesServed > 0,
  };
}

// Reads only: creates nothing at PostEx, safe with a live token
export async function checkConnection(actor: ActorContext) {
  const [cities, addresses] = await Promise.all([fetchPostexCities(), fetchPostexAddresses()]);
  await recordAudit({ admin: actor.adminId, action: 'postex.check_connection', entityType: 'Integration', after: { mode: postexMode(), cities: cities.length, addresses: addresses.length }, ip: actor.ip });
  return {
    ok: true,
    mode: postexMode(),
    cities: { total: cities.length, delivery: cities.filter((c) => c.delivery).length, pickup: cities.filter((c) => c.pickup).length },
    addresses,
  };
}

// ── Pickup / return address used for bookings ─────────

export async function updatePostexSettings(input: PostexSettingsInput, actor: ActorContext) {
  const addresses = await fetchPostexAddresses();
  const codes = new Set(addresses.map((a) => a.addressCode));
  for (const [field, code] of [['pickupAddressCode', input.pickupAddressCode], ['returnAddressCode', input.returnAddressCode]] as const) {
    if (code && !codes.has(code)) throw new AppError(`Address code ${code} is not one of your PostEx addresses (${field})`, 400);
  }

  const settings = await getSettings();
  const before = { pickupAddressCode: settings.postex?.pickupAddressCode, returnAddressCode: settings.postex?.returnAddressCode };
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  if (input.pickupAddressCode !== undefined) set['postex.pickupAddressCode'] = input.pickupAddressCode;
  if (input.returnAddressCode === null) unset['postex.returnAddressCode'] = '';
  else if (input.returnAddressCode !== undefined) set['postex.returnAddressCode'] = input.returnAddressCode;
  await Setting.updateOne({ _id: SETTINGS_ID }, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) });

  const after = (await getSettings()).postex;
  await recordAudit({ admin: actor.adminId, action: 'postex.settings_update', entityType: 'Setting', before, after: { pickupAddressCode: after?.pickupAddressCode, returnAddressCode: after?.returnAddressCode }, ip: actor.ip });
  return { pickupAddressCode: after?.pickupAddressCode ?? null, returnAddressCode: after?.returnAddressCode ?? null };
}

// ── City matching ─────────────────────────────────────

// Matches our city list to PostEx's delivery cities by name. Hand-made matches are kept.
export async function syncPostexCities(actor: ActorContext) {
  const postexCities = (await fetchPostexCities()).filter((c) => c.delivery);
  const byKey = new Map(postexCities.map((c) => [cityKey(c.name), c]));
  const ours = await City.find().select('name postex').lean();
  const now = new Date();

  const matchedKeys = new Set<string>();
  const notServed: string[] = [];
  const ops = [];
  for (const city of ours) {
    if (city.postex?.manual) {
      if (city.postex.name) matchedKeys.add(cityKey(city.postex.name));
      continue;
    }
    const found = byKey.get(cityKey(city.name));
    if (found) matchedKeys.add(cityKey(found.name));
    else notServed.push(city.name);
    ops.push({
      updateOne: {
        filter: { _id: city._id },
        update: { $set: { postex: { name: found?.name, delivers: Boolean(found), manual: false, checkedAt: now } } },
      },
    });
  }
  if (ops.length) await City.bulkWrite(ops);

  const notInOurList = postexCities.filter((c) => !matchedKeys.has(cityKey(c.name))).map((c) => c.name);
  const served = ours.length - notServed.length;
  await recordAudit({ admin: actor.adminId, action: 'postex.sync_cities', entityType: 'City', after: { postexCities: postexCities.length, served, notServed: notServed.length }, ip: actor.ip });

  return {
    postexDeliveryCities: postexCities.length,
    ourCities: ours.length,
    served,
    // Our cities PostEx does not deliver to, or spells differently (match those by hand)
    notServed: notServed.sort().slice(0, 500),
    // PostEx cities not matched to any of ours (often a different spelling)
    notInOurList: notInOurList.sort().slice(0, 500),
  };
}

export async function matchCity(cityId: string, input: MatchCityInput, actor: ActorContext) {
  if (!isValidObjectId(cityId)) throw new AppError('City not found', 404);
  const city = await City.findById(cityId);
  if (!city) throw new AppError('City not found', 404);
  const before: Record<string, unknown> | undefined = city.postex ? { ...city.toObject().postex } : undefined;

  if (input.postexCityName === null) {
    // Undo the hand match; the next sync decides again
    city.set('postex', { name: undefined, delivers: false, manual: false, checkedAt: new Date() });
  } else {
    const found = (await fetchPostexCities()).find((c) => c.delivery && cityKey(c.name) === cityKey(input.postexCityName!));
    if (!found) throw new AppError(`"${input.postexCityName}" is not a PostEx delivery city`, 400);
    city.set('postex', { name: found.name, delivers: true, manual: true, checkedAt: new Date() });
  }
  await city.save();
  await recordAudit({ admin: actor.adminId, action: 'postex.match_city', entityType: 'City', entityId: city.id, before, after: { ...city.toObject().postex }, ip: actor.ip });
  return { city: { id: city.id, name: city.name, postex: city.toObject().postex } };
}

// ── Call log ──────────────────────────────────────────

export async function listIntegrationLogs(query: IntegrationLogQuery) {
  const filter: Record<string, unknown> = { provider: 'postex' };
  if (query.action) filter.action = query.action;
  if (query.status) filter.status = query.status;
  if (query.order) filter.orderNumber = query.order.toUpperCase();
  const [items, total] = await Promise.all([
    IntegrationLog.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    IntegrationLog.countDocuments(filter),
  ]);
  return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
}