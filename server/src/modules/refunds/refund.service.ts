import mongoose, { isValidObjectId, type ClientSession } from 'mongoose';
import Refund, { type RefundDocument, type RefundItem } from '../../models/Refund.js';
import Order, { type OrderDocument } from '../../models/Order.js';
import Customer from '../../models/Customer.js';
import AppError from '../../utils/AppError.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { writeOffReturned } from '../inventory/stock.service.js';
import { changeOrder, setStatus } from '../orders/order.service.js';
import { statusLabel } from '../orders/orderStatus.js';
import type { CreateRefundInput, ListRefundsQuery, PayRefundInput, RejectRefundInput } from './refund.validation.js';

// Flow (design 3.2):
//   record (requested; order stays Delivered)
//     -> approve (order: Refund pending) -> pay (order: Refunded)
//     -> reject  (order stays or goes back to Delivered)

const OPEN = ['requested', 'approved'] as const;
const REASON_LABELS = { damaged: 'Damaged', incorrect: 'Incorrect product' } as const;

function adminId(actor: ActorContext) {
  return new mongoose.Types.ObjectId(actor.adminId);
}

// Loads the refund and its order inside ONE transaction, so two admins (or a double click)
// cannot approve or pay the same refund twice
async function changeRefund<T>(
  id: string,
  change: (refund: RefundDocument, order: OrderDocument, session: ClientSession) => Promise<T>
): Promise<T> {
  if (!isValidObjectId(id)) throw new AppError('Refund not found', 404);
  let result: T | undefined;
  await mongoose.connection.transaction(async (session) => {
    const refund = await Refund.findById(id).session(session);
    if (!refund) throw new AppError('Refund not found', 404);
    const order = await Order.findById(refund.order).session(session);
    if (!order) throw new AppError('The order for this refund was not found', 404);
    result = await change(refund, order, session);
  });
  return result as T;
}

// ── Record a refund request ───────────────────────────

export async function createRefund(input: CreateRefundInput, actor: ActorContext) {
  return changeOrder(input.order, async (order, session) => {
    if (order.status !== 'delivered') {
      throw new AppError(`Refunds are recorded only for delivered orders (this one is "${statusLabel(order.status)}")`, 409);
    }

    const open = await Refund.exists({ order: order._id, status: mongoose.trusted({ $in: OPEN }) }).session(session);
    if (open) throw new AppError('This order already has an open refund. Approve, reject or pay it first.', 409);

    const seen = new Set<string>();
    const items: RefundItem[] = input.items.map((line) => {
      if (seen.has(line.variantId)) throw new AppError('Each product size can be listed only once', 400);
      seen.add(line.variantId);

      const item = order.items.find((i) => String(i.variant) === line.variantId);
      if (!item) throw new AppError('That product size is not in this order', 400);
      const name = `${item.name} (${item.variantLabel})`;
      if (line.qty > item.qty) throw new AppError(`Only ${item.qty} of ${name} were ordered`, 400);

      // What the customer actually paid for these units (after any item discount)
      const paid = Math.round((item.lineTotal * line.qty) / item.qty);
      const amount = line.amount ?? paid;
      if (amount > paid) {
        throw new AppError(`The refund for ${line.qty} x ${name} cannot be more than Rs ${paid} (what the customer paid)`, 400);
      }
      return { variant: item.variant, name: item.name, variantLabel: item.variantLabel, sku: item.sku, qty: line.qty, amount };
    });

    const amount = items.reduce((sum, i) => sum + i.amount, 0);
    const collected = order.payment.amountCollected ?? 0;
    if (amount <= 0) throw new AppError('The refund amount must be more than Rs 0', 400);
    if (amount > collected) throw new AppError(`The refund (Rs ${amount}) cannot be more than the Rs ${collected} collected`, 400);

    const [refund] = await Refund.create(
      [
        {
          order: order._id,
          orderNumber: order.orderNumber,
          items,
          reason: input.reason,
          description: input.description,
          amount,
          requestedBy: adminId(actor),
        },
      ],
      { session }
    );

    // Writes to the order on purpose: if two refunds are opened at the same moment, the
    // transactions collide, one retries, and then it sees the open refund above
    await Order.updateOne({ _id: order._id }, { $set: { updatedAt: new Date() } }, { session, timestamps: false });

    await recordAudit(
      {
        admin: actor.adminId,
        action: 'refund.request',
        entityType: 'Refund',
        entityId: refund!.id,
        after: { order: order.orderNumber, reason: input.reason, amount },
        ip: actor.ip,
      },
      session
    );
    return { refund: refund! };
  });
}

// ── Approve ───────────────────────────────────────────

export async function approveRefund(id: string, actor: ActorContext) {
  return changeRefund(id, async (refund, order, session) => {
    if (refund.status !== 'requested') throw new AppError(`Only a requested refund can be approved (this one is "${refund.status}")`, 409);

    setStatus(order, 'refund_pending', actor, `Refund approved: Rs ${refund.amount} (${REASON_LABELS[refund.reason]})`);
    await order.save({ session });

    refund.status = 'approved';
    refund.decidedBy = adminId(actor);
    refund.decidedAt = new Date();
    await refund.save({ session });

    await recordAudit(
      { admin: actor.adminId, action: 'refund.approve', entityType: 'Refund', entityId: refund.id, before: { status: 'requested' }, after: { status: 'approved' }, ip: actor.ip },
      session
    );
    return { refund, orderStatus: statusLabel(order.status) };
  });
}

// ── Reject ────────────────────────────────────────────

export async function rejectRefund(id: string, input: RejectRefundInput, actor: ActorContext) {
  return changeRefund(id, async (refund, order, session) => {
    if (!(OPEN as readonly string[]).includes(refund.status)) {
      throw new AppError(`This refund is already "${refund.status}"`, 409);
    }
    const before = refund.status;

    if (refund.status === 'approved') {
      // The order was moved to Refund pending at approval: move it back
      setStatus(order, 'delivered', actor, `Refund rejected: ${input.reason}`);
      await order.save({ session });
    }

    refund.status = 'rejected';
    refund.rejectionReason = input.reason;
    refund.decidedBy = adminId(actor);
    refund.decidedAt = new Date();
    await refund.save({ session });

    await recordAudit(
      { admin: actor.adminId, action: 'refund.reject', entityType: 'Refund', entityId: refund.id, before: { status: before }, after: { status: 'rejected', reason: input.reason }, ip: actor.ip },
      session
    );
    return { refund, orderStatus: statusLabel(order.status) };
  });
}

// ── Mark as paid ──────────────────────────────────────

export async function payRefund(id: string, input: PayRefundInput, actor: ActorContext) {
  const now = new Date();
  if (input.paidOn && input.paidOn > now) throw new AppError('The payment date cannot be in the future', 400);

  return changeRefund(id, async (refund, order, session) => {
    if (refund.status !== 'approved') throw new AppError(`Only an approved refund can be paid (this one is "${refund.status}")`, 409);

    setStatus(order, 'refunded', actor, `Refund paid: Rs ${refund.amount} by ${input.payoutMethod}`);
    const collected = order.payment.amountCollected ?? 0;
    order.payment.status = refund.amount >= collected ? 'refunded' : 'partially_refunded';
    await order.save({ session });

    if (input.writeOff) {
      // The units already left stock at packing; this records that they will not come back to sale.
      // Spread across the batches they were packed from.
      for (const line of refund.items) {
        const item = order.items.find((i) => String(i.variant) === String(line.variant));
        let left = line.qty;
        for (const alloc of item?.batchAllocations ?? []) {
          if (left === 0) break;
          const qty = Math.min(left, alloc.qty);
          await writeOffReturned(line.variant, alloc.batch, qty, order._id, `Refund (${REASON_LABELS[refund.reason]})`, session, actor.adminId);
          left -= qty;
        }
      }
      refund.stockAction = 'written_off';
    }

    refund.status = 'paid';
    refund.payoutMethod = input.payoutMethod;
    refund.payoutReference = input.payoutReference;
    refund.paidAt = input.paidOn ?? now;
    refund.paidBy = adminId(actor);
    await refund.save({ session });

    // The customer's history shows what they actually paid
    await Customer.updateOne({ _id: order.customer }, { $inc: { 'stats.totalSpent': -refund.amount } }, { session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: 'refund.pay',
        entityType: 'Refund',
        entityId: refund.id,
        before: { status: 'approved' },
        after: { status: 'paid', amount: refund.amount, payoutMethod: input.payoutMethod, writeOff: input.writeOff },
        ip: actor.ip,
      },
      session
    );
    return { refund, orderStatus: statusLabel(order.status), paymentStatus: order.payment.status };
  });
}

// ── Lists ─────────────────────────────────────────────

export async function listRefunds(query: ListRefundsQuery) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.order) {
    if (isValidObjectId(query.order)) filter.order = query.order;
    else filter.orderNumber = query.order.toUpperCase();
  }

  const [refunds, total] = await Promise.all([
    Refund.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select('orderNumber reason amount status payoutMethod createdAt paidAt')
      .lean(),
    Refund.countDocuments(filter),
  ]);
  return { refunds, total, page: query.page, pages: Math.ceil(total / query.limit) };
}

export async function getRefund(id: string) {
  if (!isValidObjectId(id)) throw new AppError('Refund not found', 404);
  const refund = await Refund.findById(id).populate('requestedBy decidedBy paidBy', 'name').lean();
  if (!refund) throw new AppError('Refund not found', 404);
  const order = await Order.findById(refund.order).select('status payment.amountCollected').lean();
  return {
    refund,
    order: order ? { status: order.status, statusLabel: statusLabel(order.status), amountCollected: order.payment.amountCollected ?? 0 } : null,
  };
}