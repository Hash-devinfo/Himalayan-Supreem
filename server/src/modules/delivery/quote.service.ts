import mongoose from 'mongoose';
import City, { CITY_COLLATION } from '../../models/City.js';
import DeliveryZone, { type DeliveryZoneDocument, type WeightRule } from '../../models/DeliveryZone.js';
import Variant from '../../models/Variant.js';
import Product from '../../models/Product.js';
import type { Province } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { tidyCityName } from '../../utils/text.js';
import { formatPkMobile, whatsappDigits } from '../../utils/phone.js';
import { getSettings } from '../settings/settings.service.js';
import type { QuoteInput } from './delivery.validation.js';

// ── Types ─────────────────────────────────────────────

export interface ResolvedCity {
  id: string | null; // null = typed by the customer and not in our list
  name: string;
  province: Province;
  listed: boolean;
  isBlocked: boolean;
  zoneId: string | null;
}

interface QuoteCity {
  name: string;
  province: Province;
  listed: boolean;
}

export type DeliveryQuote =
  | {
      available: true;
      city: QuoteCity;
      zone: string;
      zoneId: string;
      estimateText: string;
      standardCharge: number; // before free delivery
      charge: number; // what the customer pays
      freeDelivery: boolean;
      freeDeliveryThreshold: number | null;
      amountToFreeDelivery: number | null; // "add Rs X more for free delivery"
      weightGrams: number;
      subtotal: number;
    }
  | {
      available: false;
      city: QuoteCity;
      message: string;
      support: { whatsapp: string; whatsappLink: string } | null;
    };

// ── Small pure helpers ───────────────────────────────

// Weight rules (sorted, lightest first) replace the flat charge when a zone has them.
// The first rule the parcel fits under wins. Heavier than every rule: the heaviest rule's charge.
export function chargeForWeight(zone: { charge: number; weightRules: WeightRule[] }, weightGrams: number): number {
  if (zone.weightRules.length === 0) return zone.charge;
  const rule = zone.weightRules.find((r) => weightGrams <= r.upToGrams) ?? zone.weightRules[zone.weightRules.length - 1];
  return rule ? rule.charge : zone.charge;
}

// ── City and zone lookup ─────────────────────────────

export async function resolveCity(input: { cityId?: string; cityName?: string; province?: Province }): Promise<ResolvedCity> {
  if (input.cityId) {
    const city = await City.findById(input.cityId);
    if (!city) throw new AppError('Please choose your city again', 400);
    return toResolved(city, true);
  }

  // Typed city: it may already be in our list under a different spelling of capitals
  const name = tidyCityName(input.cityName as string);
  const province = input.province as Province;
  const existing = await City.findOne({ name, province }).collation(CITY_COLLATION);
  if (existing) return toResolved(existing, true);

  return { id: null, name, province, listed: false, isBlocked: false, zoneId: null };
}

function toResolved(
  city: { id: string; name: string; province: Province; isBlocked: boolean; zone?: mongoose.Types.ObjectId },
  listed: boolean
): ResolvedCity {
  return {
    id: city.id,
    name: city.name,
    province: city.province,
    listed,
    isBlocked: city.isBlocked,
    zoneId: city.zone ? String(city.zone) : null,
  };
}

// The city's own zone if it is turned on; otherwise the default ("Other cities") zone
async function zoneForCity(city: ResolvedCity): Promise<DeliveryZoneDocument> {
  if (city.zoneId) {
    const zone = await DeliveryZone.findOne({ _id: city.zoneId, active: true });
    if (zone) return zone;
  }
  const defaultZone = await DeliveryZone.findOne({ isDefault: true, active: true });
  if (!defaultZone) {
    throw new AppError('Delivery charges are not set up yet. Please contact us to place your order.', 503);
  }
  return defaultZone;
}

// ── The quote ─────────────────────────────────────────

// Used by the public quote below, and later by the cart and checkout
// (which work out weight and subtotal from the cart themselves).
export async function calculateDelivery(city: ResolvedCity, weightGrams: number, subtotal: number): Promise<DeliveryQuote> {
  const settings = await getSettings();
  const quoteCity: QuoteCity = { name: city.name, province: city.province, listed: city.listed };

  if (city.isBlocked) {
    const number = settings.store.whatsappNumber;
    return {
      available: false,
      city: quoteCity,
      message: `Sorry, we can't deliver to ${city.name} at the moment.${number ? ' Please contact us on WhatsApp.' : ''}`,
      support: number ? { whatsapp: formatPkMobile(number), whatsappLink: `https://wa.me/${whatsappDigits(number)}` } : null,
    };
  }

  const zone = await zoneForCity(city);
  const standardCharge = chargeForWeight(zone, weightGrams);

  const threshold = settings.freeDeliveryThreshold ?? null;
  const freeDelivery = threshold !== null && subtotal >= threshold;

  return {
    available: true,
    city: quoteCity,
    zone: zone.name,
    zoneId: zone.id,
    estimateText: zone.estimateText,
    standardCharge,
    charge: freeDelivery ? 0 : standardCharge,
    freeDelivery,
    freeDeliveryThreshold: threshold,
    amountToFreeDelivery: threshold !== null && !freeDelivery ? threshold - subtotal : null,
    weightGrams,
    subtotal,
  };
}

// Public quote: the server works out weight and subtotal from the items.
// Prices and weights always come from the database, never from the browser.
export async function quoteForItems(input: QuoteInput): Promise<DeliveryQuote> {
  // The same size listed twice: add the quantities together
  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
  }

  const ids = [...quantities.keys()];
  const variantFilter: Record<string, unknown> = { _id: mongoose.trusted({ $in: ids }), status: 'active' };
  const variants = await Variant.find(variantFilter).select('product price shippingWeightGrams').lean();

  const productFilter: Record<string, unknown> = {
    _id: mongoose.trusted({ $in: variants.map((v) => v.product) }),
    status: 'published',
  };
  const publishedIds = new Set((await Product.distinct('_id', productFilter)).map(String));
  const usable = variants.filter((v) => publishedIds.has(String(v.product)));

  if (usable.length !== ids.length) {
    throw new AppError('One or more items are no longer available. Please refresh your cart.', 400);
  }

  let weightGrams = 0;
  let subtotal = 0;
  for (const variant of usable) {
    const quantity = quantities.get(String(variant._id)) ?? 0;
    weightGrams += variant.shippingWeightGrams * quantity;
    subtotal += variant.price * quantity;
  }

  const city = await resolveCity(input);
  return calculateDelivery(city, weightGrams, subtotal);
}

// ── Public city list for the checkout dropdown ───────

export async function listPublicCities() {
  return City.find({ isBlocked: false })
    .collation(CITY_COLLATION)
    .sort({ sortOrder: 1, name: 1 })
    .select('name province')
    .lean();
}