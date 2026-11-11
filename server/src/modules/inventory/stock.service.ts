import mongoose, { Types, type ClientSession } from 'mongoose';
import Batch from '../../models/Batch.js';
import Variant from '../../models/Variant.js';
import StockMovement from '../../models/StockMovement.js';
import { refreshProductSummary } from '../products/product.service.js';
import { sellableExpiryCutoff } from './expiry.js';

export interface StockLevel {
  sellable: number; // in active, unexpired batches
  reserved: number; // held by orders not yet packed
  available: number; // what customers can still buy
  shortfall: boolean; // true if reserved orders are no longer covered by sellable stock
}

// A batch can be sold while it is active, has stock left, and has not reached
// its stop-selling date (see expiry.ts).
export function sellableBatchFilter(
  variantId: Types.ObjectId | string,
  now: Date = new Date()
): Record<string, unknown> {
  return {
    variant: new Types.ObjectId(String(variantId)),
    status: 'active',
    quantityRemaining: mongoose.trusted({ $gt: 0 }),
    expiryDate: mongoose.trusted({ $gt: sellableExpiryCutoff(now) }),
  };
}

// Recalculates a size's cached availableQty from its batches, then refreshes the product summary.
// Pass the session when called inside a transaction, so everything saves together.
export async function recalculateVariantStock(
  variantId: Types.ObjectId | string,
  session?: ClientSession
): Promise<StockLevel> {
  const [totals] = await Batch.aggregate<{ total: number }>([
    { $match: sellableBatchFilter(variantId) },
    { $group: { _id: null, total: { $sum: '$quantityRemaining' } } },
  ]).session(session ?? null);

  const sellable = totals?.total ?? 0;

  const variant = await Variant.findById(variantId).session(session ?? null);
  if (!variant) {
    throw new Error(`Variant ${String(variantId)} not found while recalculating stock`);
  }

  const reserved = variant.reservedQty;
  const available = Math.max(0, sellable - reserved);

  if (variant.availableQty !== available) {
    await Variant.updateOne({ _id: variant._id }, { $set: { availableQty: available } }, { session });
  }

  await refreshProductSummary(variant.product, session);

  return { sellable, reserved, available, shortfall: reserved > sellable };
}




// ── Reserving stock for an order ──────────────────────

// Thrown when there is not enough sellable stock. The caller turns it into a customer message.
export class StockShortError extends Error {
  constructor(
    readonly variantId: string,
    readonly available: number
  ) {
    super(`Only ${available} available`);
    this.name = 'StockShortError';
  }
}

// Holds `quantity` units of a size for an order (status "new" until packing).
// MUST run inside a transaction: if two orders race for the last unit, MongoDB lets only one
// transaction change the size; the other is retried, sees the new reservation and fails.
export async function reserveStock(
  variantId: Types.ObjectId | string,
  quantity: number,
  orderId: Types.ObjectId,
  session: ClientSession
) {
  const [totals] = await Batch.aggregate<{ total: number }>([
    { $match: sellableBatchFilter(variantId) },
    { $group: { _id: null, total: { $sum: '$quantityRemaining' } } },
  ]).session(session);
  const sellable = totals?.total ?? 0;

  const variant = await Variant.findById(variantId).session(session);
  if (!variant) throw new StockShortError(String(variantId), 0);

  const available = Math.max(0, sellable - variant.reservedQty);
  if (available < quantity) throw new StockShortError(String(variantId), available);

  await Variant.updateOne({ _id: variant._id }, { $inc: { reservedQty: quantity } }, { session });
  await StockMovement.create(
    [{ type: 'reserved', variant: variant._id, product: variant.product, quantity, order: orderId }],
    { session }
  );
  await recalculateVariantStock(variant._id, session);

  return variant;
}


// Gives back stock held by an order that will not be packed (cancelled). Also inside a transaction.
export async function releaseStock(
  variantId: Types.ObjectId | string,
  quantity: number,
  orderId: Types.ObjectId,
  session: ClientSession,
  adminId?: Types.ObjectId | string
): Promise<void> {
  const filter: Record<string, unknown> = { _id: variantId, reservedQty: mongoose.trusted({ $gte: quantity }) };
  const result = await Variant.updateOne(filter, { $inc: { reservedQty: -quantity } }, { session });
  if (result.matchedCount !== 1) {
    // Should never happen: the reservation is missing. Stop rather than make stock numbers wrong.
    throw new Error(`Cannot release ${quantity} of variant ${String(variantId)}: not reserved`);
  }

  const variant = await Variant.findById(variantId).select('product').session(session);
  await StockMovement.create(
    [{ type: 'released', variant: variantId, product: variant?.product, quantity, order: orderId, admin: adminId }],
    { session }
  );
  await recalculateVariantStock(variantId, session);
}