import mongoose from 'mongoose';
import Batch from '../../models/Batch.js';
import Order, { type BatchAllocation, type OrderDocument } from '../../models/Order.js';
import type { OrderStatus } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { daysUntil, formatPktDate } from '../../utils/dates.js';
import { formatPkMobile } from '../../utils/phone.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { changeReservation, packFromBatch, sellableBatchFilter, unpackToBatch } from '../inventory/stock.service.js';
import { getSettings } from '../settings/settings.service.js';
import { changeOrder, setStatus } from './order.service.js';
import { statusLabel } from './orderStatus.js';
import type { PackOrderInput, UnpackOrderInput } from './packing.validation.js';

// ── The packing plan (design 3.5) ─────────────────────

interface BatchChoice {
  batchId: string;
  batchNumber: string;
  expiryDate: string; // Pakistan date, YYYY-MM-DD
  daysToExpiry: number;
  quantityRemaining: number;
}

// Sellable batches for one size, earliest expiry first, and a suggestion that uses them in that order
async function batchChoices(variantId: mongoose.Types.ObjectId, qty: number) {
  const batches = await Batch.find(sellableBatchFilter(variantId)).sort({ expiryDate: 1, receivedDate: 1 }).lean();

  const choices: BatchChoice[] = batches.map((b) => ({
    batchId: String(b._id),
    batchNumber: b.batchNumber,
    expiryDate: formatPktDate(b.expiryDate),
    daysToExpiry: daysUntil(b.expiryDate),
    quantityRemaining: b.quantityRemaining,
  }));

  // "First expiring, first out": take from the earliest batch, then the next, until qty is covered
  const suggested: { batchId: string; qty: number }[] = [];
  let needed = qty;
  for (const choice of choices) {
    if (needed === 0) break;
    const take = Math.min(needed, choice.quantityRemaining);
    suggested.push({ batchId: choice.batchId, qty: take });
    needed -= take;
  }

  return { choices, suggested, shortBy: needed };
}

export async function getPackingPlan(idOrNumber: string) {
  const order = await findForPacking(idOrNumber);
  if (order.status !== 'confirmed') {
    throw new AppError(`Only confirmed orders can be packed (this one is "${statusLabel(order.status)}")`, 409);
  }

  const items = [];
  for (const item of order.items) {
    const { choices, suggested, shortBy } = await batchChoices(item.variant, item.qty);
    items.push({ variantId: String(item.variant), name: item.name, variantLabel: item.variantLabel, sku: item.sku, qty: item.qty, batches: choices, suggested, shortBy });
  }

  return { orderNumber: order.orderNumber, items, canPack: items.every((i) => i.shortBy === 0) };
}

async function findForPacking(idOrNumber: string): Promise<OrderDocument> {
  const filter = mongoose.isValidObjectId(idOrNumber) ? { _id: idOrNumber } : { orderNumber: idOrNumber.trim().toUpperCase() };
  const order = await Order.findOne(filter);
  if (!order) throw new AppError('Order not found', 404);
  return order;
}

// ── Pack ──────────────────────────────────────────────

// One transaction: take units out of the chosen batches, use up the reservation, write packed
// movements, save the batch numbers on the order, status -> packing. Any problem: nothing changes.
export async function packOrder(idOrNumber: string, input: PackOrderInput, actor: ActorContext) {
  const settings = await getSettings();

    return changeOrder(idOrNumber, async (order, session) => {
    // A customer asked to cancel: decide that first (call them), so an unwanted parcel is never sent
    if (order.cancellation.requestStatus === 'requested') {
      throw new AppError('The customer has asked to cancel this order. Approve or decline the request before packing.', 409);
    }
    setStatus(order, 'packing', actor, 'Packed');

    for (const item of order.items) {
      const variantId = String(item.variant);
      let plan: { batchId: string; qty: number }[];

      if (input.items) {
        const chosen = input.items.find((i) => i.variantId === variantId);
        if (!chosen) throw new AppError(`Choose batches for ${item.name} (${item.variantLabel})`, 400);
        plan = chosen.allocations;
      } else {
        const { suggested, shortBy } = await batchChoices(item.variant, item.qty);
        if (shortBy > 0) {
          throw new AppError(`Not enough sellable stock in batches for ${item.name} (${item.variantLabel}): ${shortBy} short`, 409);
        }
        plan = suggested;
      }

      const total = plan.reduce((sum, a) => sum + a.qty, 0);
      if (total !== item.qty) {
        throw new AppError(`${item.name} (${item.variantLabel}): batches add up to ${total}, but the order has ${item.qty}`, 400);
      }
      if (new Set(plan.map((a) => a.batchId)).size !== plan.length) {
        throw new AppError(`${item.name} (${item.variantLabel}): the same batch is listed twice`, 400);
      }

      const allocations: BatchAllocation[] = [];
      for (const a of plan) {
        allocations.push(await packFromBatch(variantId, a.batchId, a.qty, order._id, session, actor.adminId));
      }
      item.batchAllocations = allocations;
      await changeReservation(variantId, -item.qty, session);
    }

    // Unknown sizes sent for this order are a mistake worth reporting
    if (input.items) {
      const orderVariants = new Set(order.items.map((i) => String(i.variant)));
      const extra = input.items.find((i) => !orderVariants.has(i.variantId));
      if (extra) throw new AppError('One of the chosen sizes is not in this order', 400);
    }

    if (order.fulfillment.packagingCost === undefined && settings.defaultPackagingCost !== undefined) {
      order.fulfillment.packagingCost = settings.defaultPackagingCost;
    }
    order.flags.stockShortfall = false;
    await order.save({ session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: 'order.pack',
        entityType: 'Order',
        entityId: order.id,
        before: { status: 'confirmed' },
        after: {
          status: 'packing',
          batches: order.items.map((i) => `${i.sku}: ${i.batchAllocations.map((b) => `${b.batchNumber} x${b.qty}`).join(', ')}`),
        },
        ip: actor.ip,
      },
      session
    );

    return { order, statusLabel: statusLabel(order.status) };
  });
}

// ── Undo packing (before shipping) ────────────────────

export async function unpackOrder(idOrNumber: string, input: UnpackOrderInput, actor: ActorContext) {
  return changeOrder(idOrNumber, async (order, session) => {
    if (order.status !== 'packing') {
      throw new AppError(`Only orders in "Packing" can be unpacked (this one is "${statusLabel(order.status)}")`, 409);
    }
    setStatus(order, 'confirmed', actor, `Packing undone: ${input.reason}`);

    let shortfall = false;
    for (const item of order.items) {
      for (const a of item.batchAllocations) {
        await unpackToBatch(item.variant, a.batch, a.qty, order._id, session, actor.adminId);
      }
      item.batchAllocations = [];
      const level = await changeReservation(item.variant, item.qty, session);
      if (level.shortfall) shortfall = true;
    }

    // If a batch expired while packed, the reserved units are no longer fully covered
    order.flags.stockShortfall = shortfall;
    await order.save({ session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: 'order.unpack',
        entityType: 'Order',
        entityId: order.id,
        before: { status: 'packing' },
        after: { status: 'confirmed', reason: input.reason },
        ip: actor.ip,
      },
      session
    );

    return { order, statusLabel: statusLabel(order.status), stockShortfall: shortfall };
  });
}

// ── Packing slip / invoice ────────────────────────────

const PACKED_OR_LATER: readonly OrderStatus[] = ['packing', 'shipped', 'delivered', 'delivery_failed', 'returned', 'refund_pending', 'refunded'];

// The data for the printed slip that goes in the parcel (the admin screen lays it out and prints it)
export async function getPackingSlip(idOrNumber: string) {
  const order = await findForPacking(idOrNumber);
  if (!PACKED_OR_LATER.includes(order.status)) {
    throw new AppError('The packing slip is available once the order is packed', 409);
  }

  const settings = await getSettings();
  const packedAt = [...order.statusHistory].reverse().find((h) => h.status === 'packing')?.at;
  const c = order.customerSnapshot;

  return {
    store: {
      name: settings.store.name,
      whatsapp: settings.store.whatsappNumber ? formatPkMobile(settings.store.whatsappNumber) : null,
      email: settings.store.email ?? null,
    },
    orderNumber: order.orderNumber,
    placedOn: formatPktDate(order.createdAt),
    packedOn: packedAt ? formatPktDate(packedAt) : null,
    shipTo: {
      name: c.name,
      phone: formatPkMobile(c.phone),
      address: [c.address.line1, c.address.line2, c.address.area].filter(Boolean).join(', '),
      city: c.address.city,
      province: c.address.province,
    },
    items: order.items.map((i) => ({
      name: i.name,
      variantLabel: i.variantLabel,
      sku: i.sku,
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      batches: i.batchAllocations.map((b) => ({ batchNumber: b.batchNumber, expiryDate: formatPktDate(b.expiryDate), qty: b.qty })),
    })),
    pricing: order.pricing,
    payment: {
      method: order.payment.method,
      // What the courier collects from the customer
      amountToCollect: order.payment.method === 'cod' ? order.pricing.total : 0,
    },
    courier: order.fulfillment.courier ?? null,
    trackingNumber: order.fulfillment.trackingNumber ?? null,
  };
}