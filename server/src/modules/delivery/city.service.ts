import mongoose, { isValidObjectId } from 'mongoose';
import City, { CITY_COLLATION, type CityDocument } from '../../models/City.js';
import DeliveryZone from '../../models/DeliveryZone.js';
import AppError from '../../utils/AppError.js';
import { tidyCityName } from '../../utils/text.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import type { AssignZoneInput, CreateCityInput, ListCitiesQuery, UpdateCityInput } from './delivery.validation.js';

async function findCityOrThrow(id: string): Promise<CityDocument> {
  if (!isValidObjectId(id)) throw new AppError('City not found', 404);
  const city = await City.findById(id);
  if (!city) throw new AppError('City not found', 404);
  return city;
}

// A city can only be put in a zone that exists and is turned on
async function assertZoneUsable(zoneId: string): Promise<void> {
  const zone = await DeliveryZone.findById(zoneId);
  if (!zone) throw new AppError('Delivery zone not found', 400);
  if (!zone.active) throw new AppError(`"${zone.name}" is turned off. Turn it on before adding cities to it.`, 400);
}

// "D.I. Khan" -> "D\.I\. Khan", so dots and brackets are searched as plain text
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listCities(query: ListCitiesQuery) {
  const filter: Record<string, unknown> = {};
  if (query.search) filter.name = mongoose.trusted({ $regex: escapeRegex(query.search), $options: 'i' });
  if (query.province) filter.province = query.province;
  if (query.zone === 'default') filter.zone = null; // no zone = uses the default zone
  else if (query.zone) filter.zone = query.zone;
  if (query.blocked !== undefined) filter.isBlocked = query.blocked;
  if (query.source) filter.source = query.source;

  const [cities, total] = await Promise.all([
    City.find(filter)
      .collation(CITY_COLLATION)
      .sort({ sortOrder: 1, name: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate('zone', 'name')
      .lean(),
    City.countDocuments(filter),
  ]);

  return { cities, total, page: query.page, pages: Math.ceil(total / query.limit) };
}

export async function createCity(input: CreateCityInput, actor: ActorContext): Promise<CityDocument> {
  const name = tidyCityName(input.name);

  const existing = await City.findOne({ name, province: input.province }).collation(CITY_COLLATION);
  if (existing) throw new AppError(`"${existing.name}, ${existing.province}" is already in the list`, 409);

  if (input.zone) await assertZoneUsable(input.zone);

  const city = await City.create({
    name,
    province: input.province,
    zone: input.zone ?? undefined,
    sortOrder: input.sortOrder,
    source: 'admin',
  });

  await recordAudit({
    admin: actor.adminId,
    action: 'city.create',
    entityType: 'City',
    entityId: city.id,
    after: { name: city.name, province: city.province, zone: input.zone ?? null },
    ip: actor.ip,
  });
  return city;
}

export async function updateCity(id: string, input: UpdateCityInput, actor: ActorContext): Promise<CityDocument> {
  const city = await findCityOrThrow(id);
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  // zone: an ID, or null = back to the default zone
  if (input.zone !== undefined) {
    const current = city.zone ? String(city.zone) : null;
    if (current !== input.zone) {
      if (input.zone) await assertZoneUsable(input.zone);
      before.zone = current;
      after.zone = input.zone;
      city.set('zone', input.zone ?? undefined);
    }
  }

  if (input.isBlocked !== undefined && input.isBlocked !== city.isBlocked) {
    before.isBlocked = city.isBlocked;
    after.isBlocked = input.isBlocked;
    city.isBlocked = input.isBlocked;
  }

  if (input.sortOrder !== undefined && input.sortOrder !== city.sortOrder) {
    before.sortOrder = city.sortOrder;
    after.sortOrder = input.sortOrder;
    city.sortOrder = input.sortOrder;
  }

  if (Object.keys(after).length === 0) return city;

  await city.save();

  await recordAudit({
    admin: actor.adminId,
    action: after.isBlocked === true ? 'city.block' : after.isBlocked === false ? 'city.unblock' : 'city.update',
    entityType: 'City',
    entityId: city.id,
    before: { city: `${city.name}, ${city.province}`, ...before },
    after,
    ip: actor.ip,
  });
  return city;
}

// Moves many cities to one zone at once (zone null = back to the default zone)
export async function assignZone(input: AssignZoneInput, actor: ActorContext) {
  if (input.zone) await assertZoneUsable(input.zone);

  const cityIds = [...new Set(input.cityIds)];
  const idFilter: Record<string, unknown> = { _id: mongoose.trusted({ $in: cityIds }) };
  const found = await City.countDocuments(idFilter);

  // Only touch cities that are not already in that zone
  const filter: Record<string, unknown> = input.zone
    ? { ...idFilter, zone: mongoose.trusted({ $ne: input.zone }) }
    : { ...idFilter, zone: mongoose.trusted({ $exists: true }) };
  const update = input.zone ? { $set: { zone: input.zone } } : { $unset: { zone: 1 } };

  const result = await City.updateMany(filter, update);

  if (result.modifiedCount > 0) {
    await recordAudit({
      admin: actor.adminId,
      action: 'city.assign_zone',
      entityType: 'City',
      after: { zone: input.zone, cityIds, changed: result.modifiedCount },
      ip: actor.ip,
    });
  }

  return {
    changed: result.modifiedCount,
    alreadyInZone: found - result.modifiedCount,
    notFound: cityIds.length - found,
  };
}