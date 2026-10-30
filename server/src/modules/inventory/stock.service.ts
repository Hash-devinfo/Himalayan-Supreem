import mongoose, { Types, type ClientSession } from 'mongoose';
import Batch from '../../models/Batch.js';
import Variant from '../../models/Variant.js';
import { refreshProductSummary } from '../products/product.service.js';

export interface StockLevel {
  sellable: number; // in active, unexpired batches
  reserved: number; // held by orders not yet packed
  available: number; // what customers can still buy
  shortfall: boolean; // true if reserved orders are no longer covered by sellable stock
}

// A batch can be sold while its expiry date is still in the future.
// Expiry dates are stored as the start of that day in Pakistan, so stock
// stops selling at 00:00 PKT on its expiry date.
export function sellableBatchFilter(
  variantId: Types.ObjectId | string,
  now: Date = new Date()
): Record<string, unknown> {
  return {
    variant: new Types.ObjectId(String(variantId)),
    status: 'active',
    quantityRemaining: mongoose.trusted({ $gt: 0 }),
    expiryDate: mongoose.trusted({ $gt: now }),
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