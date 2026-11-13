import type { ClientSession } from 'mongoose';
import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Customer from '../../models/Customer.js';
import AppError from '../../utils/AppError.js';
import { startOfTodayPkt } from '../../utils/dates.js';
import { formatPkMobile, whatsappDigits } from '../../utils/phone.js';
import { getSettings } from '../settings/settings.service.js';

// Fake-order and refusal protection (requirements 4.6, BR-16, BR-17).
// The history is counted from the orders themselves, so it can never drift out of date.

const DELIVERED = ['delivered', 'refund_pending', 'refunded'];

export type RiskLevel = 'blocked' | 'high' | 'normal';

export interface PhoneRisk {
  level: RiskLevel;
  orders: number;
  delivered: number;
  refused: number; // refused or not collected at the door
  cancelled: number;
  blockedReason: string | null;
}

// One query for many phones (e.g. a page of the order list)
export async function riskForPhones(phones: string[]): Promise<Map<string, PhoneRisk>> {
  const unique = [...new Set(phones)];
  const result = new Map<string, PhoneRisk>();
  if (unique.length === 0) return result;

  const [history, blocked, settings] = await Promise.all([
    Order.aggregate<{ _id: string; orders: number; delivered: number; refused: number; cancelled: number }>([
      { $match: { 'customerSnapshot.phone': { $in: unique } } },
      {
        $group: {
          _id: '$customerSnapshot.phone',
          orders: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ['$status', DELIVERED] }, 1, 0] } },
          refused: { $sum: { $cond: [{ $in: ['$payment.status', ['refused', 'uncollected']] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        },
      },
    ]),
    Customer.find({ phone: mongoose.trusted({ $in: unique }), isBlocked: true } as Record<string, unknown>)
      .select('phone blockedReason')
      .lean(),
    getSettings(),
  ]);

  for (const phone of unique) {
    const h = history.find((x) => x._id === phone);
    const b = blocked.find((x) => x.phone === phone);
    const refused = h?.refused ?? 0;
    result.set(phone, {
      level: b ? 'blocked' : refused >= settings.risk.refusalThreshold ? 'high' : 'normal',
      orders: h?.orders ?? 0,
      delivered: h?.delivered ?? 0,
      refused,
      cancelled: h?.cancelled ?? 0,
      blockedReason: b?.blockedReason ?? null,
    });
  }
  return result;
}

export async function riskForPhone(phone: string): Promise<PhoneRisk> {
  return (await riskForPhones([phone])).get(phone)!;
}

// ── Checks when an order is placed ────────────────────

async function contactUsDetails() {
  const settings = await getSettings();
  const number = settings.store.whatsappNumber;
  return number ? [{ field: 'support', message: `WhatsApp ${formatPkMobile(number)}` }, { field: 'supportLink', message: `https://wa.me/${whatsappDigits(number)}` }] : undefined;
}

// Blocked numbers cannot order (BR-16). The message does not say "blocked": it asks them to WhatsApp us.
export async function assertNotBlocked(phone: string): Promise<void> {
  const blocked = await Customer.exists({ phone, isBlocked: true });
  if (blocked) {
    throw new AppError("We can't take this order online. Please contact us on WhatsApp to place it.", 403, await contactUsDetails());
  }
}

// At most N orders per phone per day (Pakistan time), BR-16.
// Call INSIDE the order transaction, after the customer record is written: two orders placed at the
// same moment then collide on that record, one retries, and its count includes the other.
export async function assertDailyLimit(phone: string, session: ClientSession): Promise<void> {
  const settings = await getSettings();
  const placedToday = await Order.countDocuments({
    'customerSnapshot.phone': phone,
    createdAt: mongoose.trusted({ $gte: startOfTodayPkt() }),
  } as Record<string, unknown>).session(session);

  if (placedToday >= settings.risk.dailyOrderLimit) {
    throw new AppError(
      `You have reached today's limit of ${settings.risk.dailyOrderLimit} orders. Please contact us on WhatsApp to order more.`,
      429,
      await contactUsDetails()
    );
  }
}