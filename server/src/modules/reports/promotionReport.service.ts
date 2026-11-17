import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Promotion from '../../models/Promotion.js';
import { resolveRange } from './reportRange.js';
import type { PromotionsQuery } from './report.validation.js';

// Promotions report (requirements 4.4: "record the applied discount in order and profit reports").
// Orders PLACED in the period that got a discount, by promotion, and what became of them.
const DELIVERED = ['delivered', 'refund_pending', 'refunded'];
const RETURNED = ['delivery_failed', 'returned'];

export const PROMOTION_DEFINITIONS = {
  orders: 'Orders PLACED in the period with at least one item discounted by this promotion.',
  delivered: 'Of those, orders delivered (COD collected), including refund pending / refunded.',
  open: 'Still in progress (new, calls, confirmed, packing, shipped).',
  discountGiven: 'Discount on DELIVERED orders only: what the promotion actually cost.',
  salesAfterDiscount: 'Discounted items on delivered orders, after the discount. Delivery charges are not included.',
  shareOfDeliveredOrders: 'Delivered orders that used any promotion, as a % of all delivered orders placed in the period.',
};

type Row = {
  _id: mongoose.Types.ObjectId;
  name: string;
  orders: number;
  delivered: number;
  cancelled: number;
  returned: number;
  units: number;
  discountGiven: number;
  salesAfterDiscount: number;
};

export async function promotionsReport(query: PromotionsQuery) {
  const range = resolveRange(query.from, query.to);
  const placed = { $match: { createdAt: { $gte: range.start, $lt: range.end } } };

  const [rows, totals] = await Promise.all([
    Order.aggregate<Row>([
      placed,
      { $unwind: '$items' },
      { $match: { 'items.promotion': { $exists: true }, 'items.discount': { $gt: 0 } } },
      // One row per order and promotion first, so an order with two discounted items counts once
      {
        $group: {
          _id: { order: '$_id', promotion: '$items.promotion' },
          name: { $last: '$items.promotionName' },
          status: { $first: '$status' },
          units: { $sum: '$items.qty' },
          discount: { $sum: '$items.discount' },
          sales: { $sum: '$items.lineTotal' },
        },
      },
      {
        $group: {
          _id: '$_id.promotion',
          name: { $last: '$name' },
          orders: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ['$status', DELIVERED] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          returned: { $sum: { $cond: [{ $in: ['$status', RETURNED] }, 1, 0] } },
          units: { $sum: { $cond: [{ $in: ['$status', DELIVERED] }, '$units', 0] } },
          discountGiven: { $sum: { $cond: [{ $in: ['$status', DELIVERED] }, '$discount', 0] } },
          salesAfterDiscount: { $sum: { $cond: [{ $in: ['$status', DELIVERED] }, '$sales', 0] } },
        },
      },
      { $sort: { discountGiven: -1, orders: -1 } },
    ]),
    Order.aggregate<{ delivered: number; withPromotion: number }>([
      placed,
      { $match: { status: { $in: DELIVERED } } },
      {
        $group: {
          _id: null,
          delivered: { $sum: 1 },
          withPromotion: { $sum: { $cond: [{ $gt: [{ $sum: '$items.discount' }, 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  // Current details of each promotion (type, code, state); the name on the order is kept if it was renamed
  const promoFilter: Record<string, unknown> = { _id: mongoose.trusted({ $in: rows.map((r) => r._id) }) };
  const promos = await Promotion.find(promoFilter).select('name type code status').lean();
  const promoById = new Map(promos.map((p) => [String(p._id), p]));

  const promotions = rows.map((r) => {
    const p = promoById.get(String(r._id));
    return {
      promotionId: String(r._id),
      name: p?.name ?? r.name,
      type: p?.type ?? '',
      code: p?.code ?? '',
      status: p?.status ?? '',
      orders: r.orders,
      delivered: r.delivered,
      cancelled: r.cancelled,
      returned: r.returned,
      open: r.orders - r.delivered - r.cancelled - r.returned,
      unitsDelivered: r.units,
      discountGiven: r.discountGiven,
      salesAfterDiscount: r.salesAfterDiscount,
    };
  });

  const t = totals[0] ?? { delivered: 0, withPromotion: 0 };
  return {
    range: { from: range.from, to: range.to },
    summary: {
      promotionsUsed: promotions.length,
      ordersWithPromotion: promotions.reduce((s, p) => s + p.orders, 0),
      deliveredOrdersWithPromotion: t.withPromotion,
      shareOfDeliveredOrders: t.delivered ? Math.round((t.withPromotion / t.delivered) * 1000) / 10 : null,
      discountGiven: promotions.reduce((s, p) => s + p.discountGiven, 0),
      salesAfterDiscount: promotions.reduce((s, p) => s + p.salesAfterDiscount, 0),
    },
    promotions,
    definitions: PROMOTION_DEFINITIONS,
  };
}