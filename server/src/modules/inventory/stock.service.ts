import mongoose, { Types, type ClientSession } from 'mongoose';
import Batch from '../../models/Batch.js';
import Variant from '../../models/Variant.js';
import StockMovement from '../../models/StockMovement.js';
import { refreshProductSummary } from '../products/product.service.js';
import { sellableExpiryCutoff } from './expiry.js';
import AppError from '../../utils/AppError.js';
import { formatPktDate } from '../../utils/dates.js';





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



// ── Packing: taking units out of real batches ─────────

export interface PackedFrom {
  batch: Types.ObjectId;
  batchNumber: string;
  expiryDate: Date;
  qty: number;
}

// Takes `quantity` units out of one batch for an order being packed. Inside a transaction.
// The batch must belong to this size, be active, have enough left, and not be within the
// stop-selling period (checked by DATE, so the daily job not having run yet changes nothing).
export async function packFromBatch(
  variantId: Types.ObjectId | string,
  batchId: Types.ObjectId | string,
  quantity: number,
  orderId: Types.ObjectId,
  session: ClientSession,
  adminId: Types.ObjectId | string
): Promise<PackedFrom> {
  const condition: Record<string, unknown> = {
    _id: batchId,
    variant: variantId,
    status: 'active',
    quantityRemaining: mongoose.trusted({ $gte: quantity }),
    expiryDate: mongoose.trusted({ $gt: sellableExpiryCutoff() }),
  };
  const batch = await Batch.findOneAndUpdate(condition, { $inc: { quantityRemaining: -quantity } }, { session, returnDocument: 'after' });

  if (!batch) {
    // Explain exactly why, so the admin can choose another batch
    const found = await Batch.findById(batchId).session(session);
    if (!found || String(found.variant) !== String(variantId)) {
      throw new AppError('That batch does not belong to this product size', 400);
    }
    if (found.expiryDate <= sellableExpiryCutoff()) {
      throw new AppError(`Batch ${found.batchNumber} expires on ${formatPktDate(found.expiryDate)} and can no longer be sold`, 409);
    }
    throw new AppError(`Only ${found.quantityRemaining} left in batch ${found.batchNumber}`, 409);
  }

  if (batch.quantityRemaining === 0) {
    batch.status = 'depleted';
    await batch.save({ session });
  }

  await StockMovement.create(
    [{ type: 'packed', variant: variantId, product: batch.product, batch: batch._id, quantity, order: orderId, admin: adminId }],
    { session }
  );

  return { batch: batch._id, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, qty: quantity };
}

// Undo packing: units go back into the SAME batch they came from. Inside a transaction.
export async function unpackToBatch(
  variantId: Types.ObjectId | string,
  batchId: Types.ObjectId | string,
  quantity: number,
  orderId: Types.ObjectId,
  session: ClientSession,
  adminId: Types.ObjectId | string
): Promise<void> {
  const batch = await Batch.findOneAndUpdate(
    { _id: batchId, variant: variantId },
    { $inc: { quantityRemaining: quantity } },
    { session, returnDocument: 'after' }
  );
  if (!batch) throw new Error(`Batch ${String(batchId)} not found while undoing packing`);

  // A batch that ran out is in use again. (A written-off batch stays written off.)
  if (batch.status === 'depleted') {
    batch.status = 'active';
    await batch.save({ session });
  }

  await StockMovement.create(
    [{ type: 'unpacked', variant: variantId, product: batch.product, batch: batch._id, quantity, order: orderId, admin: adminId }],
    { session }
  );
}

// Moves units between "reserved" and "taken out of batches" on the size itself, then recalculates.
// change < 0: packing (reservation used up). change > 0: undo packing (reserved again).
export async function changeReservation(
  variantId: Types.ObjectId | string,
  change: number,
  session: ClientSession
): Promise<StockLevel> {
  const filter: Record<string, unknown> = { _id: variantId };
  if (change < 0) filter.reservedQty = mongoose.trusted({ $gte: -change });
  const result = await Variant.updateOne(filter, { $inc: { reservedQty: change } }, { session });
  if (result.matchedCount !== 1) {
    throw new Error(`Cannot change reservation of variant ${String(variantId)} by ${change}`);
  }
  return recalculateVariantStock(variantId, session);
}