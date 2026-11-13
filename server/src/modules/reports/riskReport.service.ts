import { formatPkMobile } from '../../utils/phone.js';
import Order from '../../models/Order.js';
import { getSettings } from '../settings/settings.service.js';
import { riskForPhones } from '../customers/risk.service.js';
import { resolveRange } from './reportRange.js';
import type { RiskQuery } from './report.validation.js';

// Risk overview (requirements 7): refusals and cancellations by phone number and by city.
const DELIVERED = ['delivered', 'refund_pending', 'refunded'];

export const RISK_DEFINITIONS = {
  orders: 'Orders PLACED in the period (any channel), by their state today.',
  refused: 'Parcels refused at the door or not collected (payment status refused or uncollected).',
  refusalRate: 'Refused / (delivered + refused): of the parcels that reached the door, how many came back.',
  cancelled: 'Cancelled before packing (no stock or courier cost lost).',
  phones: 'Phone numbers with at least one refusal or cancellation in the period, most refusals first. Risk level is all-time (badge rules in Settings).',
};

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

const COUNTS = {
  orders: { $sum: 1 },
  delivered: { $sum: { $cond: [{ $in: ['$status', DELIVERED] }, 1, 0] } },
  refused: { $sum: { $cond: [{ $in: ['$payment.status', ['refused', 'uncollected']] }, 1, 0] } },
  cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
};

export async function riskReport(query: RiskQuery) {
  const range = resolveRange(query.from, query.to);
  const match = { $match: { createdAt: { $gte: range.start, $lt: range.end } } };

  const [totals, byCity, byPhone, settings] = await Promise.all([
    Order.aggregate<{ orders: number; delivered: number; refused: number; cancelled: number }>([match, { $group: { _id: null, ...COUNTS } }]),
    Order.aggregate<{ _id: { city: string; province: string }; orders: number; delivered: number; refused: number; cancelled: number }>([
      match,
      { $group: { _id: { city: '$customerSnapshot.address.city', province: '$customerSnapshot.address.province' }, ...COUNTS } },
      { $sort: { refused: -1, cancelled: -1, orders: -1 } },
    ]),
    Order.aggregate<{ _id: string; name: string; orders: number; delivered: number; refused: number; cancelled: number }>([
      match,
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$customerSnapshot.phone', name: { $first: '$customerSnapshot.name' }, ...COUNTS } },
      { $match: { $or: [{ refused: { $gt: 0 } }, { cancelled: { $gt: 0 } }] } },
      { $sort: { refused: -1, cancelled: -1 } },
      { $limit: 100 },
    ]),
    getSettings(),
  ]);

  const risk = await riskForPhones(byPhone.map((p) => p._id));
  const t = totals[0] ?? { orders: 0, delivered: 0, refused: 0, cancelled: 0 };

  return {
    range: { from: range.from, to: range.to },
    summary: {
      ordersPlaced: t.orders,
      delivered: t.delivered,
      refused: t.refused,
      cancelled: t.cancelled,
      refusalPercent: pct(t.refused, t.delivered + t.refused),
      cancellationPercent: pct(t.cancelled, t.orders),
      highRiskThreshold: settings.risk.refusalThreshold,
    },
    byCity: byCity.map((c) => ({
      city: c._id.city,
      province: c._id.province,
      orders: c.orders,
      delivered: c.delivered,
      refused: c.refused,
      cancelled: c.cancelled,
      refusalPercent: pct(c.refused, c.delivered + c.refused),
    })),
    phones: byPhone.map((p) => ({
      phone: formatPkMobile(p._id),
      name: p.name,
      orders: p.orders,
      delivered: p.delivered,
      refused: p.refused,
      cancelled: p.cancelled,
      riskLevel: risk.get(p._id)?.level ?? 'normal',
    })),
    definitions: RISK_DEFINITIONS,
  };
}