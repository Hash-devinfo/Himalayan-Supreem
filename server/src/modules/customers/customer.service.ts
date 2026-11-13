import mongoose from 'mongoose';
import Customer from '../../models/Customer.js';
import Order from '../../models/Order.js';
import { formatPktDate } from '../../utils/dates.js';
import { formatPkMobile, normalizePkMobile } from '../../utils/phone.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { getSettings } from '../settings/settings.service.js';
import { statusLabel } from '../orders/orderStatus.js';
import { riskForPhone, riskForPhones } from './risk.service.js';
import type { BlockCustomerInput, ListCustomersQuery, UnblockCustomerInput } from './customer.validation.js';

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── List: search, blocked numbers, high-risk numbers ──

export async function listCustomers(query: ListCustomersQuery) {
  const filter: Record<string, unknown> = {};

  if (query.search) {
    const phone = normalizePkMobile(query.search);
    if (phone) filter.phone = phone;
    else filter.name = mongoose.trusted({ $regex: escapeRegex(query.search), $options: 'i' });
  }
  if (query.filter === 'blocked') filter.isBlocked = true;

  if (query.filter === 'highRisk') {
    // Phones with refusals at or above the threshold, worked out from the orders
    const settings = await getSettings();
    const risky = await Order.aggregate<{ _id: string }>([
      { $match: { 'payment.status': { $in: ['refused', 'uncollected'] } } },
      { $group: { _id: '$customerSnapshot.phone', refused: { $sum: 1 } } },
      { $match: { refused: { $gte: settings.risk.refusalThreshold } } },
    ]);
    const riskyPhones = risky.map((r) => r._id);
    // Searching for one phone AND high risk: show it only if that phone is high risk
    if (typeof filter.phone === 'string') {
      if (!riskyPhones.includes(filter.phone)) return { customers: [], total: 0, page: query.page, pages: 0 };
    } else {
      filter.phone = mongoose.trusted({ $in: riskyPhones });
    }
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ 'stats.lastOrderAt': -1, createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select('name phone email phoneVerified isBlocked stats createdAt')
      .lean(),
    Customer.countDocuments(filter),
  ]);
  const risk = await riskForPhones(customers.map((c) => c.phone));

  return {
    customers: customers.map((c) => ({
      id: String(c._id),
      name: c.name,
      phone: formatPkMobile(c.phone),
      email: c.email ?? null,
      phoneVerified: c.phoneVerified,
      risk: risk.get(c.phone),
      lastOrderAt: c.stats?.lastOrderAt ?? null,
    })),
    total,
    page: query.page,
    pages: Math.ceil(total / query.limit),
  };
}

// ── One phone number: history and recent orders ───────

export async function getCustomer(phone: string) {
  const [customer, risk, recent] = await Promise.all([
    Customer.findOne({ phone }).populate('blockedBy', 'name').lean(),
    riskForPhone(phone),
    Order.find({ 'customerSnapshot.phone': phone })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('orderNumber status createdAt pricing.total payment.status customerSnapshot.address.city')
      .lean(),
  ]);

  return {
    phone: formatPkMobile(phone),
    customer: customer
      ? {
          name: customer.name,
          email: customer.email ?? null,
          phoneVerified: customer.phoneVerified,
          isBlocked: customer.isBlocked,
          blockedReason: customer.blockedReason ?? null,
          blockedAt: customer.blockedAt ?? null,
          blockedBy: (customer.blockedBy as unknown as { name?: string } | undefined)?.name ?? null,
        }
      : null,
    risk,
    recentOrders: recent.map((o) => ({
      orderNumber: o.orderNumber,
      status: statusLabel(o.status),
      placedOn: formatPktDate(o.createdAt),
      city: o.customerSnapshot.address.city,
      total: o.pricing.total,
      payment: o.payment.status,
    })),
  };
}

// ── Block and unblock ─────────────────────────────────

// A number can be blocked even if it never ordered (e.g. known from another store)
export async function blockCustomer(phone: string, input: BlockCustomerInput, actor: ActorContext) {
  const customer = await Customer.findOneAndUpdate(
    { phone },
    {
      $set: { isBlocked: true, blockedReason: input.reason, blockedAt: new Date(), blockedBy: new mongoose.Types.ObjectId(actor.adminId) },
      $setOnInsert: { name: 'Unknown (blocked before ordering)' },
    },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  await recordAudit({
    admin: actor.adminId,
    action: 'customer.block',
    entityType: 'Customer',
    entityId: String(customer!._id),
    after: { phone, reason: input.reason },
    ip: actor.ip,
  });
  return getCustomer(phone);
}

export async function unblockCustomer(phone: string, input: UnblockCustomerInput, actor: ActorContext) {
  const before = await Customer.findOneAndUpdate(
    { phone, isBlocked: true },
    { $set: { isBlocked: false }, $unset: { blockedReason: 1, blockedAt: 1, blockedBy: 1 } }
  ).lean();

  if (before) {
    await recordAudit({
      admin: actor.adminId,
      action: 'customer.unblock',
      entityType: 'Customer',
      entityId: String(before._id),
      before: { phone, reason: before.blockedReason ?? null },
      after: { blocked: false, ...(input.note ? { note: input.note } : {}) },
      ip: actor.ip,
    });
  }
  return getCustomer(phone);
}