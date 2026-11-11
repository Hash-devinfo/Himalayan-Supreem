import mongoose from 'mongoose';
import Order from '../../models/Order.js';
import Customer from '../../models/Customer.js';
import AppError from '../../utils/AppError.js';
import { startOfTodayPkt } from '../../utils/dates.js';
import { whatsappDigits } from '../../utils/phone.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { recalculateVariantStock, restockReturned, writeOffReturned } from '../inventory/stock.service.js';
import { changeOrder, setStatus } from './order.service.js';
import { statusLabel } from './orderStatus.js';
import type { DeliverOrderInput, FailDeliveryInput, RemitInput, ReturnOrderInput, ShipOrderInput } from './fulfillment.validation.js';

const FAILURE_LABELS = { refused: 'Refused by customer', uncollected: 'Not collected', address_issue: 'Address problem', other: 'Other' } as const;

// ── Shipped (first dispatch, or courier re-attempt) ──

export async function shipOrder(idOrNumber: string, input: ShipOrderInput, actor: ActorContext) {
  return changeOrder(idOrNumber, async (order, session) => {
    const before = order.status;
    const reattempt = before === 'delivery_failed';

    if (!reattempt) {
      if (!input.courier || !input.trackingNumber) {
        throw new AppError('Choose the courier and enter the tracking number', 400);
      }
    }

    const tracking = input.trackingNumber ?? order.fulfillment.trackingNumber;
    if (input.trackingNumber) {
      // The same courier number on two parcels is almost always a typing mistake
      const filter: Record<string, unknown> = { 'fulfillment.trackingNumber': input.trackingNumber, _id: mongoose.trusted({ $ne: order._id }) };
      const other = await Order.findOne(filter).select('orderNumber').session(session);
      if (other) throw new AppError(`Tracking number ${input.trackingNumber} is already used on order ${other.orderNumber}`, 409);
    }

    setStatus(order, 'shipped', actor, input.note ?? (reattempt ? 'Courier re-attempt' : `Dispatched with ${input.courier?.toUpperCase()}`));

    if (input.courier) order.fulfillment.courier = input.courier;
    order.fulfillment.trackingNumber = tracking;
    if (!order.fulfillment.dispatchedAt) order.fulfillment.dispatchedAt = new Date();
    if (input.courierFee !== undefined) order.fulfillment.courierFee = input.courierFee;
    if (input.codCharge !== undefined) order.fulfillment.codCharge = input.codCharge;
    if (reattempt) order.payment.status = 'pending'; // the courier will try to collect again

    await order.save({ session });
    await recordAudit(
      {
        admin: actor.adminId,
        action: reattempt ? 'order.reattempt' : 'order.ship',
        entityType: 'Order',
        entityId: order.id,
        before: { status: before },
        after: { status: 'shipped', courier: order.fulfillment.courier, trackingNumber: order.fulfillment.trackingNumber },
        ip: actor.ip,
      },
      session
    );
    return { order, statusLabel: statusLabel(order.status) };
  });
}

// ── Delivered: COD collected ──────────────────────────

export async function deliverOrder(idOrNumber: string, input: DeliverOrderInput, actor: ActorContext) {
  return changeOrder(idOrNumber, async (order, session) => {
    const amount = input.amountCollected ?? (order.payment.method === 'cod' ? order.pricing.total : 0);
    if (amount !== order.pricing.total && !input.note) {
      throw new AppError(`The order total is Rs ${order.pricing.total}. Add a note explaining why Rs ${amount} was collected.`, 400);
    }

    setStatus(order, 'delivered', actor, input.note ?? 'Delivered, COD collected');
    const now = new Date();
    order.fulfillment.deliveredAt = now;
    order.payment.status = 'collected';
    order.payment.amountCollected = amount;
    order.payment.collectedAt = now;
    order.payment.remittanceStatus = 'pending'; // the courier still holds the money
    await order.save({ session });

    // The customer's history: one more delivered order, and what they actually paid
    await Customer.updateOne(
      { _id: order.customer },
      { $inc: { 'stats.deliveredCount': 1, 'stats.totalSpent': amount } },
      { session }
    );

    await recordAudit(
      {
        admin: actor.adminId,
        action: 'order.deliver',
        entityType: 'Order',
        entityId: order.id,
        before: { status: 'shipped' },
        after: { status: 'delivered', amountCollected: amount },
        ip: actor.ip,
      },
      session
    );
    return { order, statusLabel: statusLabel(order.status) };
  });
}

// ── Delivery failed ───────────────────────────────────

export async function failDelivery(idOrNumber: string, input: FailDeliveryInput, actor: ActorContext) {
  return changeOrder(idOrNumber, async (order, session) => {
    const label = FAILURE_LABELS[input.reason];
    setStatus(order, 'delivery_failed', actor, input.note ? `${label}: ${input.note}` : label);
    order.fulfillment.failedAt = new Date();
    order.fulfillment.failureReason = input.note ? `${input.reason}: ${input.note}` : input.reason;
    order.payment.status = input.reason === 'refused' ? 'refused' : 'uncollected';
    await order.save({ session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: 'order.delivery_failed',
        entityType: 'Order',
        entityId: order.id,
        before: { status: 'shipped' },
        after: { status: 'delivery_failed', reason: input.reason },
        ip: actor.ip,
      },
      session
    );
    return {
      order,
      statusLabel: statusLabel(order.status),
      // Message the customer before deciding: re-attempt or return (template text comes with notifications)
      whatsappLink: `https://wa.me/${whatsappDigits(order.customerSnapshot.phone)}`,
    };
  });
}

// ── Returned parcel: restock or write off, per item ──

export async function returnOrder(idOrNumber: string, input: ReturnOrderInput, actor: ActorContext) {
  return changeOrder(idOrNumber, async (order, session) => {
    setStatus(order, 'returned', actor, input.note ?? 'Parcel returned');

    const orderVariants = new Set(order.items.map((i) => String(i.variant)));
    if (input.items.some((i) => !orderVariants.has(i.variantId))) {
      throw new AppError('One of the sizes is not in this order', 400);
    }

    const decisions: string[] = [];
    for (const item of order.items) {
      const choice = input.items.find((i) => i.variantId === String(item.variant));
      if (!choice) throw new AppError(`Choose restock or write off for ${item.name} (${item.variantLabel})`, 400);

      for (const a of item.batchAllocations) {
        if (choice.decision === 'restock') {
          await restockReturned(item.variant, a.batch, a.qty, order._id, session, actor.adminId);
        } else {
          await writeOffReturned(item.variant, a.batch, a.qty, order._id, choice.reason ?? 'Returned', session, actor.adminId);
        }
      }
      await recalculateVariantStock(item.variant, session);
      decisions.push(`${item.sku}: ${choice.decision}`);
    }

    const all = new Set(input.items.map((i) => i.decision));
    order.fulfillment.returnedAt = new Date();
    order.fulfillment.returnDecision = all.size === 1 ? input.items[0]?.decision : undefined; // mixed: see each item's movements
    await order.save({ session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: 'order.return',
        entityType: 'Order',
        entityId: order.id,
        before: { status: 'delivery_failed' },
        after: { status: 'returned', decisions },
        ip: actor.ip,
      },
      session
    );
    return { order, statusLabel: statusLabel(order.status) };
  });
}

// ── COD remittance: the courier paid the store ───────

// All chosen orders are marked together, or none (if any is not delivered or already remitted)
export async function markRemitted(input: RemitInput, actor: ActorContext) {
  const remittedAt = input.remittedOn ?? startOfTodayPkt();
  const keys = [...new Set(input.orders.map((o) => o.trim()))];
  let result: { count: number; total: number; orders: string[] } = { count: 0, total: 0, orders: [] };

  await mongoose.connection.transaction(async (session) => {
    const ids = keys.filter((k) => mongoose.isValidObjectId(k));
    const numbers = keys.filter((k) => !mongoose.isValidObjectId(k)).map((k) => k.toUpperCase());
    // Every $-operator we build ourselves is marked trusted, including the ones inside $or
    const filter: Record<string, unknown> = {
      $or: mongoose.trusted([{ _id: mongoose.trusted({ $in: ids }) }, { orderNumber: mongoose.trusted({ $in: numbers }) }]),
    };
    const orders = await Order.find(filter).session(session);

    if (orders.length !== keys.length) throw new AppError('One or more orders were not found', 404);
    const notReady = orders.find((o) => o.status !== 'delivered' || o.payment.remittanceStatus !== 'pending');
    if (notReady) {
      throw new AppError(
        notReady.payment.remittanceStatus === 'remitted'
          ? `Order ${notReady.orderNumber} is already marked as paid by the courier`
          : `Order ${notReady.orderNumber} is not delivered with COD collected`,
        409
      );
    }

    for (const order of orders) {
      order.payment.remittanceStatus = 'remitted';
      order.payment.remittedAt = remittedAt;
      order.payment.remittanceRef = input.reference;
      await order.save({ session });
    }

    result = {
      count: orders.length,
      total: orders.reduce((sum, o) => sum + (o.payment.amountCollected ?? 0), 0),
      orders: orders.map((o) => o.orderNumber),
    };

    await recordAudit(
      {
        admin: actor.adminId,
        action: 'order.remit',
        entityType: 'Order',
        after: { reference: input.reference, orders: result.orders, total: result.total },
        ip: actor.ip,
      },
      session
    );
  });

  return result;
}