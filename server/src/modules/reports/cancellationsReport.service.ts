import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Refund from '../../models/Refund.js';
import { formatPktDate } from '../../utils/dates.js';
import { resolveRange } from './reportRange.js';
import type { CancellationsQuery } from './report.validation.js';

const UNANSWERED = ['no_answer', 'busy', 'switched_off', 'wrong_number'];

const CANCEL_TYPES = {
  request_approved: 'Customer asked to cancel (request approved)',
  customer_on_call: 'Customer cancelled on the confirmation call',
  no_answer: 'Not reachable after 3 calls',
  other: 'Cancelled by admin (other reason)',
} as const;
type CancelType = keyof typeof CANCEL_TYPES;

export const CANCELLATION_DEFINITIONS = {
  cancelled: 'Orders cancelled in the period (by cancellation date, Pakistan time). Cancelled orders never shipped: no stock was lost.',
  cancellationRate: 'Of the orders PLACED in the period, how many are cancelled now.',
  type: 'Worked out from the order: an approved cancellation request, a "customer cancelled" call, 3 unanswered calls, or another admin reason.',
  refundsPaid: 'Refunds marked paid in the period (by payment date). Same total as the sales and profit reports.',
  refundsRequested: 'Refund requests recorded in the period, by what happened to them since.',
  openRefunds: 'Refunds waiting for a decision or payment right now (all time). Deal with these.',
};

interface CancelledOrder {
  orderNumber: string;
  pricing: { total: number };
  contactAttempts: { outcome: string }[];
  cancellation?: { requestStatus?: string; reason?: string; decidedAt?: Date };
}

function cancelType(order: CancelledOrder): CancelType {
  if (order.cancellation?.requestStatus === 'approved') return 'request_approved';
  const calls = order.contactAttempts ?? [];
  if (calls.at(-1)?.outcome === 'customer_cancelled') return 'customer_on_call';
  if (calls.filter((c) => UNANSWERED.includes(c.outcome)).length >= 3) return 'no_answer';
  return 'other';
}

export async function cancellationsReport(query: CancellationsQuery) {
  const range = resolveRange(query.from, query.to);
  const { start, end } = range;

  // sanitizeFilter is on: our own $-operators are marked trusted
  const cancelledFilter: Record<string, unknown> = {
    status: 'cancelled',
    'cancellation.decidedAt': mongoose.trusted({ $gte: start, $lt: end }),
  };
  const placedFilter: Record<string, unknown> = { createdAt: mongoose.trusted({ $gte: start, $lt: end }) };

  const [cancelled, placed, placedNowCancelled, refundsPaid, paidByProduct, refundsRequested, openRefunds] = await Promise.all([
    Order.find(cancelledFilter)
      .select('orderNumber pricing.total contactAttempts.outcome cancellation.requestStatus cancellation.reason cancellation.decidedAt')
      .sort({ 'cancellation.decidedAt': -1 })
      .lean<CancelledOrder[]>(),
    Order.countDocuments(placedFilter),
    Order.countDocuments({ ...placedFilter, status: 'cancelled' }),

    Refund.aggregate<{ _id: { reason: string; method: string | null }; refunds: number; amount: number; writtenOff: number }>([
      { $match: { status: 'paid', paidAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { reason: '$reason', method: '$payoutMethod' },
          refunds: { $sum: 1 },
          amount: { $sum: '$amount' },
          writtenOff: { $sum: { $cond: [{ $eq: ['$stockAction', 'written_off'] }, 1, 0] } },
        },
      },
    ]),

    Refund.aggregate<{ _id: string; label: string; qty: number; amount: number; refunds: number }>([
      { $match: { status: 'paid', paidAt: { $gte: start, $lt: end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.sku',
          label: { $first: { $concat: ['$items.name', ' (', '$items.variantLabel', ')'] } },
          qty: { $sum: '$items.qty' },
          amount: { $sum: '$items.amount' },
          refunds: { $sum: 1 },
        },
      },
      { $sort: { amount: -1 } },
    ]),

    Refund.aggregate<{ _id: string; refunds: number; amount: number }>([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: '$status', refunds: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),

    Refund.find({ status: mongoose.trusted({ $in: ['requested', 'approved'] }) } as Record<string, unknown>)
      .select('orderNumber status reason amount createdAt')
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  // Cancellations by type
  const byType = new Map<CancelType, { orders: number; value: number }>();
  for (const order of cancelled) {
    const type = cancelType(order);
    const row = byType.get(type) ?? { orders: 0, value: 0 };
    row.orders += 1;
    row.value += order.pricing.total;
    byType.set(type, row);
  }

  // Refunds paid, by reason and by payout method
  const sumBy = (key: 'reason' | 'method') => {
    const map = new Map<string, { refunds: number; amount: number }>();
    for (const r of refundsPaid) {
      const k = r._id[key] ?? 'Not recorded';
      const row = map.get(k) ?? { refunds: 0, amount: 0 };
      row.refunds += r.refunds;
      row.amount += r.amount;
      map.set(k, row);
    }
    return [...map.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.amount - a.amount);
  };
  const REASON_LABELS: Record<string, string> = { damaged: 'Damaged', incorrect: 'Incorrect product' };

  return {
    range: { from: range.from, to: range.to },
    summary: {
      ordersPlaced: placed,
      cancelled: cancelled.length,
      cancelledValue: cancelled.reduce((s, o) => s + o.pricing.total, 0),
      cancellationPercent: placed ? Math.round((placedNowCancelled / placed) * 1000) / 10 : null,
      refundsPaid: refundsPaid.reduce((s, r) => s + r.refunds, 0),
      refundsPaidAmount: refundsPaid.reduce((s, r) => s + r.amount, 0),
      refundsWrittenOff: refundsPaid.reduce((s, r) => s + r.writtenOff, 0),
      openRefunds: openRefunds.length,
      openRefundsAmount: openRefunds.reduce((s, r) => s + r.amount, 0),
    },
    cancellations: {
      byType: (Object.keys(CANCEL_TYPES) as CancelType[])
        .filter((t) => byType.has(t))
        .map((t) => ({ type: t, label: CANCEL_TYPES[t], ...byType.get(t)! })),
      // The admin's own words for each cancellation (newest first, up to 100)
      recent: cancelled.slice(0, 100).map((o) => ({
        orderNumber: o.orderNumber,
        date: o.cancellation?.decidedAt ? formatPktDate(o.cancellation.decidedAt) : null,
        type: CANCEL_TYPES[cancelType(o)],
        reason: o.cancellation?.reason ?? '',
        value: o.pricing.total,
      })),
    },
    refunds: {
      paidByReason: sumBy('reason').map((r) => ({ reason: r.key, label: REASON_LABELS[r.key] ?? r.key, refunds: r.refunds, amount: r.amount })),
      paidByMethod: sumBy('method').map((r) => ({ method: r.key, refunds: r.refunds, amount: r.amount })),
      paidByProduct: paidByProduct.map((r) => ({ sku: r._id, label: r.label, qty: r.qty, amount: r.amount, refunds: r.refunds })),
      requestedInPeriod: refundsRequested.map((r) => ({ status: r._id, refunds: r.refunds, amount: r.amount })),
      open: openRefunds.map((r) => ({
        refundId: String(r._id),
        orderNumber: r.orderNumber,
        status: r.status,
        reason: REASON_LABELS[r.reason] ?? r.reason,
        amount: r.amount,
        recordedOn: formatPktDate(r.createdAt),
      })),
    },
    definitions: CANCELLATION_DEFINITIONS,
  };
}