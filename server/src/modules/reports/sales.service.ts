import type { PipelineStage } from 'mongoose';
import Order from '../../models/Order.js';
import Refund from '../../models/Refund.js';
import { PKT_TIME_ZONE } from '../../utils/dates.js';
import { COURIER_NAMES } from '../notifications/templates.js';
import { resolveRange } from './reportRange.js';
import type { SalesGroup, SalesQuery } from './report.validation.js';

// A sale counts when the order is DELIVERED (COD money collected), on its delivery date.
// Orders refunded later still count as sales; their refunds are subtracted (by refund paid date).
const DELIVERED = ['delivered', 'refund_pending', 'refunded'];

// Shown with every report, so the numbers are never ambiguous (requirements section 7)
export const SALES_DEFINITIONS = {
  sales: 'Orders delivered in the period, counted on their delivery date (Pakistan time).',
  grossSales: 'Item prices x quantities, before discounts. Delivery charges are NOT included.',
  discounts: 'Item discounts plus order discounts.',
  refunds: 'Refunds marked paid in the period (by payment date), for any order.',
  netSales: 'Gross sales - discounts - refunds. Delivery charges are NOT included.',
  deliveryCharges: 'Delivery charges paid by customers on those orders (shown separately; passed to the courier).',
  averageOrderValue: 'Items after discounts / delivered orders. Delivery charges are NOT included.',
};

function deliveredMatch(start: Date, end: Date): PipelineStage.Match {
  return { $match: { status: { $in: DELIVERED }, 'fulfillment.deliveredAt': { $gte: start, $lt: end } } };
}

export async function salesReport(query: SalesQuery) {
  const range = resolveRange(query.from, query.to);
  const match = deliveredMatch(range.start, range.end);

  const [totalsRow] = await Order.aggregate<{
    orders: number; gross: number; itemDiscounts: number; orderDiscounts: number; itemsAfterDiscount: number; delivery: number; collected: number;
  }>([
    match,
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        gross: { $sum: { $sum: { $map: { input: '$items', as: 'i', in: { $multiply: ['$$i.unitPrice', '$$i.qty'] } } } } },
        itemDiscounts: { $sum: { $sum: '$items.discount' } },
        orderDiscounts: { $sum: '$pricing.discountTotal' },
        itemsAfterDiscount: { $sum: { $subtract: ['$pricing.subtotal', '$pricing.discountTotal'] } },
        delivery: { $sum: '$pricing.deliveryCharge' },
        collected: { $sum: { $ifNull: ['$payment.amountCollected', 0] } },
      },
    },
  ]);

  const [refundRow] = await Refund.aggregate<{ count: number; amount: number }>([
    { $match: { status: 'paid', paidAt: { $gte: range.start, $lt: range.end } } },
    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
  ]);

  // Every order PLACED in the period, whatever happened to it
  const placedRows = await Order.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const placedBy = Object.fromEntries(placedRows.map((r) => [r._id, r.count]));
  const placedTotal = placedRows.reduce((s, r) => s + r.count, 0);

  const t = totalsRow ?? { orders: 0, gross: 0, itemDiscounts: 0, orderDiscounts: 0, itemsAfterDiscount: 0, delivery: 0, collected: 0 };
  const refunds = refundRow?.amount ?? 0;

  return {
    range: { from: range.from, to: range.to },
    summary: {
      deliveredOrders: t.orders,
      grossSales: t.gross,
      discounts: t.itemDiscounts + t.orderDiscounts,
      refunds,
      refundCount: refundRow?.count ?? 0,
      netSales: t.itemsAfterDiscount - refunds,
      deliveryCharges: t.delivery,
      codCollected: t.collected,
      averageOrderValue: t.orders ? Math.round(t.itemsAfterDiscount / t.orders) : 0,
    },
    placed: {
      total: placedTotal,
      cancelled: placedBy.cancelled ?? 0,
      // still between New and Shipped (or failed delivery): not a sale yet
      open: placedTotal - (placedBy.cancelled ?? 0) - DELIVERED.reduce((s, k) => s + (placedBy[k] ?? 0), 0) - (placedBy.returned ?? 0),
      returned: placedBy.returned ?? 0,
    },
    groupBy: query.groupBy,
    rows: await salesRows(query.groupBy, match),
    definitions: SALES_DEFINITIONS,
  };
}

// ── Breakdowns ────────────────────────────────────────

const ITEM_SUMS = {
  orders: { $addToSet: '$_id' },
  qty: { $sum: '$items.qty' },
  gross: { $sum: { $multiply: ['$items.unitPrice', '$items.qty'] } },
  discounts: { $sum: '$items.discount' },
  sales: { $sum: '$items.lineTotal' },
};
const ITEM_OUT = { _id: 0, orders: { $size: '$orders' }, qty: 1, gross: 1, discounts: 1, sales: 1 };

async function salesRows(groupBy: SalesGroup, match: PipelineStage.Match) {
  switch (groupBy) {
    case 'day':
    case 'courier': {
      const key =
        groupBy === 'day'
          ? { $dateToString: { format: '%Y-%m-%d', date: '$fulfillment.deliveredAt', timezone: PKT_TIME_ZONE } }
          : { $ifNull: ['$fulfillment.courier', 'none'] };
      const rows = await Order.aggregate<{ key: string; orders: number; sales: number; deliveryCharges: number }>([
        match,
        {
          $group: {
            _id: key,
            orders: { $sum: 1 },
            sales: { $sum: { $subtract: ['$pricing.subtotal', '$pricing.discountTotal'] } },
            deliveryCharges: { $sum: '$pricing.deliveryCharge' },
          },
        },
        { $sort: groupBy === 'day' ? { _id: 1 } : { sales: -1 } },
        { $project: { _id: 0, key: '$_id', orders: 1, sales: 1, deliveryCharges: 1 } },
      ]);
      return groupBy === 'courier'
        ? rows.map((r) => ({ ...r, label: COURIER_NAMES[r.key as keyof typeof COURIER_NAMES] ?? 'Not recorded' }))
        : rows.map((r) => ({ ...r, label: r.key }));
    }

    case 'variant':
      return Order.aggregate([
        match,
        { $unwind: '$items' },
        { $group: { _id: '$items.variant', sku: { $first: '$items.sku' }, name: { $first: '$items.name' }, size: { $first: '$items.variantLabel' }, ...ITEM_SUMS } },
        { $sort: { sales: -1 } },
        { $project: { ...ITEM_OUT, variantId: '$_id', label: { $concat: ['$name', ' (', '$size', ')'] }, sku: 1 } },
      ]);

    case 'product':
      return Order.aggregate([
        match,
        { $unwind: '$items' },
        { $group: { _id: '$items.product', name: { $first: '$items.name' }, ...ITEM_SUMS } },
        { $sort: { sales: -1 } },
        { $project: { ...ITEM_OUT, productId: '$_id', label: '$name' } },
      ]);

    case 'category':
      return Order.aggregate([
        match,
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p', pipeline: [{ $project: { category: 1 } }] } },
        { $lookup: { from: 'categories', localField: 'p.category', foreignField: '_id', as: 'c', pipeline: [{ $project: { name: 1 } }] } },
        { $group: { _id: { $first: '$c._id' }, name: { $first: { $first: '$c.name' } }, ...ITEM_SUMS } },
        { $sort: { sales: -1 } },
        { $project: { ...ITEM_OUT, categoryId: '$_id', label: { $ifNull: ['$name', 'Unknown category'] } } },
      ]);
  }
}