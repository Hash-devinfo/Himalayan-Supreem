import Order, { type OrderDocument } from '../../models/Order.js';
import type { OrderStatus } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { formatPktDate } from '../../utils/dates.js';
import { formatPkMobile, whatsappDigits } from '../../utils/phone.js';
import { recordAudit } from '../audit/audit.service.js';
import { getSettings } from '../settings/settings.service.js';
import { CANCELLABLE } from './orderStatus.js';
import type { LookupOrderInput, RequestCancellationInput } from './orderPublic.validation.js';

// What customers see: plain words, never internal steps like "contact attempt 2"
const CUSTOMER_STATUS: Record<OrderStatus, string> = {
  new: 'Order placed: we will call you to confirm',
  contact_attempt_1: 'Order placed: we will call you to confirm',
  contact_attempt_2: 'Order placed: we will call you to confirm',
  contact_attempt_3: 'Order placed: we tried to call you, please contact us',
  confirmed: 'Confirmed',
  packing: 'Being packed',
  shipped: 'On the way',
  delivered: 'Delivered',
  delivery_failed: 'Delivery attempt failed: we will contact you',
  returned: 'Returned to us',
  cancelled: 'Cancelled',
  refund_pending: 'Refund in progress',
  refunded: 'Refunded',
};

// One message for "no such order" AND "wrong phone", so nobody can test which order numbers exist
const NOT_FOUND = "We couldn't find an order with that order number and phone number";

async function findCustomerOrder(input: LookupOrderInput): Promise<OrderDocument> {
  const order = await Order.findOne({ orderNumber: input.orderNumber, 'customerSnapshot.phone': input.phone });
  if (!order) throw new AppError(NOT_FOUND, 404);
  return order;
}

// 0300 1234567 -> 0300 ***4567 (enough to recognise, not enough to copy)
function maskPhone(stored: string): string {
  const shown = formatPkMobile(stored);
  return `${shown.slice(0, 5)}***${shown.slice(-4)}`;
}

async function supportContact() {
  const settings = await getSettings();
  const number = settings.store.whatsappNumber;
  return number ? { whatsapp: formatPkMobile(number), whatsappLink: `https://wa.me/${whatsappDigits(number)}` } : null;
}

async function toCustomerView(order: OrderDocument) {
  const cancellationRequested = order.cancellation.requestStatus === 'requested';
  const shipped = ['shipped', 'delivered', 'delivery_failed', 'returned'].includes(order.status);

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    statusText: CUSTOMER_STATUS[order.status],
    placedOn: formatPktDate(order.createdAt),
    customer: { name: order.customerSnapshot.name, phone: maskPhone(order.customerSnapshot.phone) },
    city: order.customerSnapshot.address.city,
    items: order.items.map((i) => ({ name: i.name, variantLabel: i.variantLabel, qty: i.qty, lineTotal: i.lineTotal })),
    pricing: order.pricing,
    paymentMethod: order.payment.method,
    delivery: {
      estimateText: order.deliveryZone.estimateText,
      courier: shipped ? (order.fulfillment.courier ?? null) : null,
      trackingNumber: shipped ? (order.fulfillment.trackingNumber ?? null) : null,
      dispatchedOn: order.fulfillment.dispatchedAt ? formatPktDate(order.fulfillment.dispatchedAt) : null,
      deliveredOn: order.fulfillment.deliveredAt ? formatPktDate(order.fulfillment.deliveredAt) : null,
    },
    cancellation: {
      requested: cancellationRequested,
      declined: order.cancellation.requestStatus === 'declined',
      canRequest: CANCELLABLE.includes(order.status) && !cancellationRequested,
    },
    support: await supportContact(),
  };
}

// ── Order status lookup ───────────────────────────────

export async function lookupOrder(input: LookupOrderInput) {
  return toCustomerView(await findCustomerOrder(input));
}

// ── Cancellation request (design 3.6) ─────────────────

// The status does NOT change: the admin sees a badge, calls the customer, then approves or declines
export async function requestCancellation(input: RequestCancellationInput) {
  const order = await findCustomerOrder(input);

  if (order.cancellation.requestStatus === 'requested') {
    return { ...(await toCustomerView(order)), message: 'Your cancellation request has already been received. We will contact you on WhatsApp.' };
  }
  if (order.status === 'cancelled') throw new AppError('This order is already cancelled', 409);
  if (!CANCELLABLE.includes(order.status)) {
    throw new AppError(
      'Your order is already being packed or is on its way, so it can no longer be cancelled online. Please contact us on WhatsApp.',
      409
    );
  }

  order.cancellation.requestStatus = 'requested';
  order.cancellation.requestedVia = 'status_page';
  order.cancellation.requestedAt = new Date();
  order.cancellation.reason = input.reason;
  order.cancellation.decidedAt = undefined;
  order.cancellation.decidedBy = undefined;
  await order.save();

  await recordAudit({
    action: 'order.cancellation_requested',
    entityType: 'Order',
    entityId: order.id,
    after: { requestedVia: 'status_page', reason: input.reason ?? null },
  });

  return { ...(await toCustomerView(order)), message: 'Your cancellation request has been received. We will contact you on WhatsApp to confirm.' };
}