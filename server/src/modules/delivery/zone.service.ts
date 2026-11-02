import mongoose, { isValidObjectId } from 'mongoose';
import DeliveryZone, { type DeliveryZoneDocument } from '../../models/DeliveryZone.js';
import City, { CITY_COLLATION } from '../../models/City.js';
import AppError from '../../utils/AppError.js';
import { diffChanges } from '../../utils/diffChanges.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import type { CreateZoneInput, UpdateZoneInput } from './delivery.validation.js';

export async function findZoneOrThrow(id: string): Promise<DeliveryZoneDocument> {
  if (!isValidObjectId(id)) throw new AppError('Delivery zone not found', 404);
  const zone = await DeliveryZone.findById(id);
  if (!zone) throw new AppError('Delivery zone not found', 404);
  return zone;
}

async function assertZoneNameAvailable(name: string, excludeId?: string): Promise<void> {
  const existing = await DeliveryZone.findOne({ name }).collation(CITY_COLLATION);
  if (existing && existing.id !== excludeId) throw new AppError(`A zone named "${existing.name}" already exists`, 409);
}

// All zones, the default first, each with how many cities use it.
// Cities with no zone use the default zone, so they are counted there.
export async function listZones() {
  const zones = await DeliveryZone.find().sort({ isDefault: -1, sortOrder: 1, name: 1 }).lean();

  const counts = await City.aggregate<{ _id: mongoose.Types.ObjectId | null; count: number }>([
    { $group: { _id: { $ifNull: ['$zone', null] }, count: { $sum: 1 } } },
  ]);
  const countFor = (id: mongoose.Types.ObjectId | null): number =>
    counts.find((c) => String(c._id) === String(id))?.count ?? 0;
  const withoutZone = countFor(null);

  return {
    zones: zones.map((zone) => ({
      ...zone,
      cityCount: countFor(zone._id) + (zone.isDefault ? withoutZone : 0),
    })),
    hasDefault: zones.some((zone) => zone.isDefault),
    citiesWithoutZone: withoutZone,
  };
}

export async function createZone(input: CreateZoneInput, actor: ActorContext): Promise<DeliveryZoneDocument> {
  await assertZoneNameAvailable(input.name);
  const zone = await DeliveryZone.create(input);

  await recordAudit({
    admin: actor.adminId,
    action: 'zone.create',
    entityType: 'DeliveryZone',
    entityId: zone.id,
    after: { name: zone.name, charge: zone.charge, estimateText: zone.estimateText, weightRules: zone.toObject().weightRules },
    ip: actor.ip,
  });
  return zone;
}

export async function updateZone(id: string, input: UpdateZoneInput, actor: ActorContext): Promise<DeliveryZoneDocument> {
  const zone = await findZoneOrThrow(id);
  const { before, after, hasChanges } = diffChanges(zone.toObject(), input);
  if (!hasChanges) return zone;

  if (after.name !== undefined) await assertZoneNameAvailable(input.name as string, zone.id);

  if (after.active === false) {
    if (zone.isDefault) {
      throw new AppError('The default zone cannot be turned off. Make another zone the default first.', 400);
    }
    const cityCount = await City.countDocuments({ zone: zone._id });
    if (cityCount > 0) {
      throw new AppError(`${cityCount} city/cities use "${zone.name}". Move them to another zone first.`, 400);
    }
  }

  zone.set(after);
  await zone.save();

  await recordAudit({
    admin: actor.adminId,
    action: 'zone.update',
    entityType: 'DeliveryZone',
    entityId: zone.id,
    before,
    after,
    ip: actor.ip,
  });
  return zone;
}

// Makes this zone the default ("all other cities"). The old default stops being the default.
export async function makeDefaultZone(id: string, actor: ActorContext): Promise<DeliveryZoneDocument> {
  const zone = await findZoneOrThrow(id);
  if (zone.isDefault) return zone;
  if (!zone.active) throw new AppError('Turn this zone on before making it the default', 400);

  const previous = await DeliveryZone.findOne({ isDefault: true });

  await mongoose.connection.transaction(async (session) => {
    // Order matters: the database allows only one default, so remove the old one first
    if (previous) {
      await DeliveryZone.updateOne({ _id: previous._id }, { isDefault: false }, { session });
    }
    await DeliveryZone.updateOne({ _id: zone._id }, { isDefault: true }, { session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: 'zone.make_default',
        entityType: 'DeliveryZone',
        entityId: zone.id,
        before: { defaultZone: previous?.name ?? null },
        after: { defaultZone: zone.name },
        ip: actor.ip,
      },
      session
    );
  });

  zone.isDefault = true;
  return zone;
}