import mongoose, { type Types } from 'mongoose';
import Order from '../models/Order.js';
import { CANCELLABLE } from '../modules/orders/orderStatus.js';

// Stock shortfall (design F3): an order reserved stock, then a batch expired or was written off,
// so there is no longer enough sellable stock for every open order of that size.
// Oldest orders keep their stock first; the NEWER orders that are no longer covered are flagged,
// so the admin can call those customers. Orders that are covered again are un-flagged.
export async function flagShortfallOrders(shortVariants: Map<string, number>): Promise<{ flagged: number; cleared: number }> {
  const openStatuses = mongoose.trusted({ $in: CANCELLABLE });
  const toFlag: Types.ObjectId[] = [];

  for (const [variantId, sellable] of shortVariants) {
    const filter: Record<string, unknown> = { status: openStatuses, 'items.variant': new mongoose.Types.ObjectId(variantId) };
    const orders = await Order.find(filter).select('items.variant items.qty createdAt').sort({ createdAt: 1 }).lean();

    let covered = sellable;
    for (const order of orders) {
      const qty = order.items.filter((i) => String(i.variant) === variantId).reduce((s, i) => s + i.qty, 0);
      if (qty <= covered) covered -= qty;
      else {
        covered = 0;
        toFlag.push(order._id);
      }
    }
  }

  const flagFilter: Record<string, unknown> = { _id: mongoose.trusted({ $in: toFlag }), 'flags.stockShortfall': mongoose.trusted({ $ne: true }) };
  const flagged = toFlag.length ? (await Order.updateMany(flagFilter, { $set: { 'flags.stockShortfall': true } })).modifiedCount : 0;

  // Open orders still flagged but now covered (stock received, or another order was cancelled)
  const clearFilter: Record<string, unknown> = { status: openStatuses, 'flags.stockShortfall': true, _id: mongoose.trusted({ $nin: toFlag }) };
  const cleared = (await Order.updateMany(clearFilter, { $set: { 'flags.stockShortfall': false } })).modifiedCount;

  return { flagged, cleared };
}