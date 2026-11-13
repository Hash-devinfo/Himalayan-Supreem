import type { PipelineStage } from 'mongoose';
import Order from '../../models/Order.js';
import type { OrderStatus } from '../../constants/enums.js';
import { COURIER_NAMES } from '../notifications/templates.js';
import { statusLabel } from '../orders/orderStatus.js';
import { resolveRange } from './reportRange.js';
import type { FulfillmentQuery } from './report.validation.js';

const DAY_MS = 86_400_000;
// Delivered orders, including ones refunded later: the courier collected their COD either way
const DELIVERED = ['delivered', 'refund_pending', 'refunded'];

const FAILURE_LABELS: Record<string, string> = {
  refused: 'Refused by customer',
  uncollected: 'Not collected',
  address_issue: 'Address problem',
  other: 'Other',
};

export const FULFILLMENT_DEFINITIONS = {
  ordersByStatus: 'Orders PLACED in the period, by their status today.',
  couriers: 'Per courier: delivered, failed and returned in the period (each counted on the date it happened).',
  daysToDeliver: 'Average days from dispatch to delivery, for orders delivered in the period.',
  successRate: 'Delivered / (delivered + failed) in the period. A failed delivery that was re-attempted and then delivered counts in both.',
  failures: 'Failed deliveries in the period, by reason (the latest failure of each order).',
  codHeld: 'COD collected by couriers and NOT yet paid to you: all time, as of now. Chase the oldest first.',
  codRemitted: 'COD the couriers paid to you in the period (by remittance date).',
};

function courierName(key: string | null | undefined): string {
  return key ? (COURIER_NAMES[key as keyof typeof COURIER_NAMES] ?? key) : 'Not recorded';
}

const inRange = (field: string, start: Date, end: Date): PipelineStage.Match => ({ $match: { [field]: { $gte: start, $lt: end } } });

export async function fulfillmentReport(query: FulfillmentQuery) {
  const range = resolveRange(query.from, query.to);
  const { start, end } = range;

  const [byStatus, delivered, failed, returned, failures, codHeld, codRemitted] = await Promise.all([
    Order.aggregate<{ _id: OrderStatus; count: number }>([
      inRange('createdAt', start, end),
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Order.aggregate<{ _id: string | null; orders: number; totalDays: number; timed: number }>([
      { $match: { status: { $in: DELIVERED } } },
      inRange('fulfillment.deliveredAt', start, end),
      {
        $group: {
          _id: '$fulfillment.courier',
          orders: { $sum: 1 },
          // dispatch -> delivery, only where both dates exist
          totalDays: {
            $sum: {
              $cond: [
                { $and: ['$fulfillment.dispatchedAt', '$fulfillment.deliveredAt'] },
                { $divide: [{ $subtract: ['$fulfillment.deliveredAt', '$fulfillment.dispatchedAt'] }, DAY_MS] },
                0,
              ],
            },
          },
          timed: { $sum: { $cond: [{ $and: ['$fulfillment.dispatchedAt', '$fulfillment.deliveredAt'] }, 1, 0] } },
        },
      },
    ]),

    Order.aggregate<{ _id: string | null; orders: number }>([
      inRange('fulfillment.failedAt', start, end),
      { $group: { _id: '$fulfillment.courier', orders: { $sum: 1 } } },
    ]),

    Order.aggregate<{ _id: string | null; orders: number }>([
      { $match: { status: 'returned' } },
      inRange('fulfillment.returnedAt', start, end),
      { $group: { _id: '$fulfillment.courier', orders: { $sum: 1 } } },
    ]),

    // failureReason is "refused" or "refused: note"; group by the part before the colon
    Order.aggregate<{ _id: string; orders: number }>([
      inRange('fulfillment.failedAt', start, end),
      { $group: { _id: { $first: { $split: [{ $ifNull: ['$fulfillment.failureReason', 'other'] }, ':'] } }, orders: { $sum: 1 } } },
      { $sort: { orders: -1 } },
    ]),

    Order.aggregate<{ _id: string | null; orders: number; amount: number; oldest: Date }>([
      { $match: { status: { $in: DELIVERED }, 'payment.remittanceStatus': 'pending' } },
      {
        $group: {
          _id: '$fulfillment.courier',
          orders: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$payment.amountCollected', 0] } },
          oldest: { $min: '$fulfillment.deliveredAt' },
        },
      },
      { $sort: { amount: -1 } },
    ]),

    Order.aggregate<{ _id: string | null; orders: number; amount: number }>([
      { $match: { 'payment.remittanceStatus': 'remitted' } },
      inRange('payment.remittedAt', start, end),
      { $group: { _id: '$fulfillment.courier', orders: { $sum: 1 }, amount: { $sum: { $ifNull: ['$payment.amountCollected', 0] } } } },
    ]),
  ]);

  // One row per courier that appears anywhere above
  const couriers = new Set<string>([...delivered, ...failed, ...returned].map((r) => r._id ?? 'none'));
  const find = (rows: { _id: string | null; orders: number }[], key: string) => rows.find((r) => (r._id ?? 'none') === key);

  const courierRows = [...couriers].map((key) => {
    const d = delivered.find((r) => (r._id ?? 'none') === key);
    const deliveredCount = d?.orders ?? 0;
    const failedCount = find(failed, key)?.orders ?? 0;
    return {
      courier: key,
      label: courierName(key === 'none' ? null : key),
      delivered: deliveredCount,
      failed: failedCount,
      returned: find(returned, key)?.orders ?? 0,
      successPercent: deliveredCount + failedCount ? Math.round((deliveredCount / (deliveredCount + failedCount)) * 1000) / 10 : null,
      avgDaysToDeliver: d?.timed ? Math.round((d.totalDays / d.timed) * 10) / 10 : null,
    };
  });
  courierRows.sort((a, b) => b.delivered - a.delivered);

  const now = Date.now();
  const heldRows = codHeld.map((r) => ({
    courier: r._id ?? 'none',
    label: courierName(r._id),
    orders: r.orders,
    amount: r.amount,
    oldestDeliveredDaysAgo: r.oldest ? Math.floor((now - r.oldest.getTime()) / DAY_MS) : null,
  }));

  const totalDelivered = courierRows.reduce((s, r) => s + r.delivered, 0);
  const totalFailed = courierRows.reduce((s, r) => s + r.failed, 0);

  return {
    range: { from: range.from, to: range.to },
    summary: {
      ordersPlaced: byStatus.reduce((s, r) => s + r.count, 0),
      delivered: totalDelivered,
      failed: totalFailed,
      returned: courierRows.reduce((s, r) => s + r.returned, 0),
      successPercent: totalDelivered + totalFailed ? Math.round((totalDelivered / (totalDelivered + totalFailed)) * 1000) / 10 : null,
      codHeldAmount: heldRows.reduce((s, r) => s + r.amount, 0),
      codHeldOrders: heldRows.reduce((s, r) => s + r.orders, 0),
      codRemittedAmount: codRemitted.reduce((s, r) => s + r.amount, 0),
    },
    ordersByStatus: byStatus.map((r) => ({ status: r._id, label: statusLabel(r._id), count: r.count })),
    couriers: courierRows,
    failures: failures.map((r) => ({ reason: r._id, label: FAILURE_LABELS[r._id] ?? r._id, orders: r.orders })),
    codHeld: heldRows,
    codRemitted: codRemitted.map((r) => ({ courier: r._id ?? 'none', label: courierName(r._id), orders: r.orders, amount: r.amount })),
    definitions: FULFILLMENT_DEFINITIONS,
  };
}