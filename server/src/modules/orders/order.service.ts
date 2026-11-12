import mongoose, { isValidObjectId, type ClientSession } from "mongoose";
import Order, { type OrderDocument } from "../../models/Order.js";
import Customer from "../../models/Customer.js";
import type { ContactOutcome, OrderStatus } from "../../constants/enums.js";
import AppError from "../../utils/AppError.js";
import { addDays } from "../../utils/dates.js";
import {
  formatPkMobile,
  normalizePkMobile,
  whatsappDigits,
} from "../../utils/phone.js";
import { recordAudit, type ActorContext } from "../audit/audit.service.js";
import { releaseStock } from "../inventory/stock.service.js";
import {
  AWAITING_CALL,
  CANCELLABLE,
  assertCanChange,
  statusLabel,
} from "./orderStatus.js";
import { notifyOrder } from "../notifications/notification.service.js";
import type {
  CancelOrderInput,
  DeclineCancellationInput,
  ListOrdersQuery,
  LogCallInput,
  RecordCancellationRequestInput,
  UpdateNotesInput,
} from "./order.validation.js";
// Calls that did not reach the customer
const UNANSWERED: readonly ContactOutcome[] = [
  "no_answer",
  "busy",
  "switched_off",
  "wrong_number",
];
const MAX_UNANSWERED_CALLS = 3;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Finding orders ────────────────────────────────────

// By database ID, or by order number (HS-261112-0001)
async function findOrderOrThrow(
  idOrNumber: string,
  session?: ClientSession,
): Promise<OrderDocument> {
  const filter = isValidObjectId(idOrNumber)
    ? { _id: idOrNumber }
    : { orderNumber: idOrNumber.trim().toUpperCase() };
  const order = await Order.findOne(filter).session(session ?? null);
  if (!order) throw new AppError("Order not found", 404);
  return order;
}

export async function listOrders(query: ListOrdersQuery) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  if (query.search) {
    const phone = normalizePkMobile(query.search);
    if (phone) {
      filter["customerSnapshot.phone"] = phone;
    } else if (/^[A-Za-z]{2,6}-\d{6}-\d{4,}$/.test(query.search)) {
      filter.orderNumber = query.search.toUpperCase();
    } else {
      const pattern = mongoose.trusted({
        $regex: escapeRegex(query.search),
        $options: "i",
      });
      filter.$or = mongoose.trusted([
        { orderNumber: pattern },
        { "customerSnapshot.name": pattern },
      ]);
    }
  }

  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = query.from;
    if (query.to) range.$lt = addDays(query.to, 1); // "to" includes that whole day
    filter.createdAt = mongoose.trusted(range);
  }

  if (query.flag === "unlistedCity") filter["flags.unlistedCity"] = true;
  if (query.flag === "stockShortfall") filter["flags.stockShortfall"] = true;
  if (query.flag === "cancellationRequested")
    filter["cancellation.requestStatus"] = "requested";

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select(
        "orderNumber status createdAt customerSnapshot.name customerSnapshot.phone customerSnapshot.address.city pricing.total items.qty contactAttempts.outcome flags cancellation.requestStatus",
      )
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders: orders.map((o) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      status: o.status,
      statusLabel: statusLabel(o.status),
      placedAt: o.createdAt,
      customerName: o.customerSnapshot.name,
      phone: formatPkMobile(o.customerSnapshot.phone),
      city: o.customerSnapshot.address.city,
      total: o.pricing.total,
      units: o.items.reduce((sum, item) => sum + item.qty, 0),
      calls: o.contactAttempts.length,
      flags: {
        ...o.flags,
        cancellationRequested: o.cancellation?.requestStatus === "requested",
      },
    })),
    total,
    page: query.page,
    pages: Math.ceil(total / query.limit),
  };
}

// Full details for the order screen, plus ready-made links for calling and WhatsApp
export async function getOrder(idOrNumber: string) {
  const order = await findOrderOrThrow(idOrNumber);
  const phone = order.customerSnapshot.phone;
  return {
    order,
    statusLabel: statusLabel(order.status),
    contact: {
      phone: formatPkMobile(phone),
      callLink: `tel:${phone}`,
      whatsappLink: `https://wa.me/${whatsappDigits(phone)}`,
    },
  };
}

// ── Changing an order ─────────────────────────────────

// Every order change: one transaction (order + stock + customer + audit together).
// Reading the order INSIDE the transaction means two admins clicking at once can never both act.
export async function changeOrder<T>(
  idOrNumber: string,
  change: (order: OrderDocument, session: ClientSession) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  await mongoose.connection.transaction(async (session) => {
    const order = await findOrderOrThrow(idOrNumber, session);
    result = await change(order, session);
  });
  return result as T;
}

export function setStatus(
  order: OrderDocument,
  to: OrderStatus,
  actor: ActorContext,
  note?: string,
): void {
  assertCanChange(order.status, to);
  order.status = to;
  order.statusHistory.push({
    status: to,
    at: new Date(),
    by: new mongoose.Types.ObjectId(actor.adminId),
    note,
  });
}

// Gives back the reserved stock of every item (before packing only)
async function releaseOrderStock(
  order: OrderDocument,
  actor: ActorContext,
  session: ClientSession,
): Promise<void> {
  for (const item of order.items) {
    await releaseStock(
      item.variant,
      item.qty,
      order._id,
      session,
      actor.adminId,
    );
  }
}

// Logs a confirmation call (design 3.4). Unanswered: next attempt. Confirmed: the phone is verified.
// Customer cancelled: the order is cancelled and its stock released.
export async function logCall(
  idOrNumber: string,
  input: LogCallInput,
  actor: ActorContext,
) {
  const result = await changeOrder(idOrNumber, async (order, session) => {
    if (!AWAITING_CALL.includes(order.status)) {
      throw new AppError(
        `Calls are logged only before the order is confirmed (it is "${statusLabel(order.status)}")`,
        409,
      );
    }

    const before = order.status;
    const attemptNo = order.contactAttempts.length + 1;
    const unansweredSoFar = order.contactAttempts.filter((a) =>
      UNANSWERED.includes(a.outcome),
    ).length;

    if (UNANSWERED.includes(input.outcome)) {
      if (unansweredSoFar >= MAX_UNANSWERED_CALLS) {
        throw new AppError(
          "Three calls have gone unanswered. Cancel the order, or log a call that reached the customer.",
          409,
        );
      }
      const next = `contact_attempt_${unansweredSoFar + 1}` as OrderStatus;
      setStatus(
        order,
        next,
        actor,
        input.note ?? `Call ${attemptNo}: ${input.outcome.replace("_", " ")}`,
      );
    } else if (input.outcome === "confirmed") {
      setStatus(order, "confirmed", actor, input.note ?? "Confirmed on call");
      await Customer.updateOne(
        { _id: order.customer },
        { $set: { phoneVerified: true, verifiedVia: "confirmation_call" } },
        { session },
      );
    } else {
      // customer_cancelled
      setStatus(order, "cancelled", actor, input.note);
      order.cancellation.reason = input.note;
      order.cancellation.confirmedOnCall = true;
      order.cancellation.decidedAt = new Date();
      order.cancellation.decidedBy = new mongoose.Types.ObjectId(actor.adminId);
      if (order.cancellation.requestStatus === "requested")
        order.cancellation.requestStatus = "approved";
      await releaseOrderStock(order, actor, session);
    }

    order.contactAttempts.push({
      attemptNo,
      at: new Date(),
      outcome: input.outcome,
      note: input.note,
      by: new mongoose.Types.ObjectId(actor.adminId),
    });
    await order.save({ session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: "order.call",
        entityType: "Order",
        entityId: order.id,
        before: { status: before },
        after: {
          status: order.status,
          call: attemptNo,
          outcome: input.outcome,
        },
        ip: actor.ip,
      },
      session,
    );

    const unansweredNow =
      unansweredSoFar + (UNANSWERED.includes(input.outcome) ? 1 : 0);
    return {
      order,
      statusLabel: statusLabel(order.status),
      // After a missed call the admin can send a WhatsApp message (template text comes with notifications)
      whatsappLink: UNANSWERED.includes(input.outcome)
        ? `https://wa.me/${whatsappDigits(order.customerSnapshot.phone)}`
        : undefined,
      canCancelForNoAnswer:
        unansweredNow >= MAX_UNANSWERED_CALLS &&
        order.status === "contact_attempt_3",
    };
  });

  // After saving: the confirmed or cancelled email
  if (result.order.status === "confirmed")
    notifyOrder(result.order._id, "confirmed");
  if (result.order.status === "cancelled")
    notifyOrder(result.order._id, "cancelled");
  return result;
}

// Cancels an order before packing and gives back its stock (design 3.2)
export async function cancelOrder(idOrNumber: string, input: CancelOrderInput, actor: ActorContext) {
  const result = await changeOrder(idOrNumber, async (order, session) => {
    if (!CANCELLABLE.includes(order.status)) {
      throw new AppError(
        order.status === "cancelled"
          ? "This order is already cancelled"
          : `Only orders not yet packed can be cancelled (this one is "${statusLabel(order.status)}")`,
        409,
      );
    }

    const before = order.status;
    setStatus(order, "cancelled", actor, input.reason);
    order.cancellation.reason = input.reason;
    order.cancellation.decidedAt = new Date();
    order.cancellation.decidedBy = new mongoose.Types.ObjectId(actor.adminId);
    if (order.cancellation.requestStatus === "requested") {
      // Approving the customer's request: design 3.6 says the admin confirms it on a WhatsApp call first
      order.cancellation.requestStatus = "approved";
      order.cancellation.confirmedOnCall = true;
    }

    await releaseOrderStock(order, actor, session);
    await order.save({ session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: "order.cancel",
        entityType: "Order",
        entityId: order.id,
        before: { status: before },
        after: { status: "cancelled", reason: input.reason },
        ip: actor.ip,
      },
      session,
    );

       return { order, statusLabel: statusLabel(order.status) };
  });

  notifyOrder(result.order._id, 'cancelled');
  return result;
}


// Private notes for the admin (never shown to customers)
export async function updateNotes(
  idOrNumber: string,
  input: UpdateNotesInput,
  actor: ActorContext,
) {
  return changeOrder(idOrNumber, async (order, session) => {
    const before = order.adminNotes ?? null;
    const after = input.adminNotes || undefined;
    if ((before ?? undefined) === after) return { order };

    order.adminNotes = after;
    await order.save({ session });
    await recordAudit(
      {
        admin: actor.adminId,
        action: "order.notes",
        entityType: "Order",
        entityId: order.id,
        before: { adminNotes: before },
        after: { adminNotes: after ?? null },
        ip: actor.ip,
      },
      session,
    );
    return { order };
  });
}

// ── Cancellation requests (design 3.6) ────────────────

// The customer asked by WhatsApp: the admin records it, so it shows as a badge like status-page requests
export async function recordCancellationRequest(
  idOrNumber: string,
  input: RecordCancellationRequestInput,
  actor: ActorContext,
) {
  return changeOrder(idOrNumber, async (order, session) => {
    if (!CANCELLABLE.includes(order.status)) {
      throw new AppError(
        `Only orders not yet packed can be cancelled (this one is "${statusLabel(order.status)}")`,
        409,
      );
    }
    if (order.cancellation.requestStatus === "requested") return { order };

    order.cancellation.requestStatus = "requested";
    order.cancellation.requestedVia = "whatsapp";
    order.cancellation.requestedAt = new Date();
    order.cancellation.reason = input.reason;
    order.cancellation.decidedAt = undefined;
    order.cancellation.decidedBy = undefined;
    await order.save({ session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: "order.cancellation_requested",
        entityType: "Order",
        entityId: order.id,
        after: { requestedVia: "whatsapp", reason: input.reason ?? null },
        ip: actor.ip,
      },
      session,
    );
    return { order };
  });
}

// After the WhatsApp call the customer wants to keep the order: the badge goes, the note is kept
export async function declineCancellationRequest(
  idOrNumber: string,
  input: DeclineCancellationInput,
  actor: ActorContext,
) {
  return changeOrder(idOrNumber, async (order, session) => {
    if (order.cancellation.requestStatus !== "requested") {
      throw new AppError(
        "There is no open cancellation request on this order",
        409,
      );
    }

    order.cancellation.requestStatus = "declined";
    order.cancellation.confirmedOnCall = true;
    order.cancellation.decidedAt = new Date();
    order.cancellation.decidedBy = new mongoose.Types.ObjectId(actor.adminId);
    // The status stays the same; the history records the decision
    order.statusHistory.push({
      status: order.status,
      at: new Date(),
      by: new mongoose.Types.ObjectId(actor.adminId),
      note: `Cancellation request declined: ${input.note}`,
    });
    await order.save({ session });

    await recordAudit(
      {
        admin: actor.adminId,
        action: "order.cancellation_declined",
        entityType: "Order",
        entityId: order.id,
        before: { requestStatus: "requested" },
        after: { requestStatus: "declined", note: input.note },
        ip: actor.ip,
      },
      session,
    );
    return { order, statusLabel: statusLabel(order.status) };
  });
}
