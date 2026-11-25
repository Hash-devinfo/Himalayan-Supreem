import mongoose, { isValidObjectId } from 'mongoose';
import City from '../../../models/City.js';
import Order, { type OrderDocument } from '../../../models/Order.js';
import Variant from '../../../models/Variant.js';
import { isPostexConfigured, postexPdf, postexRequest } from '../../../providers/couriers/postex/postexClient.js';
import AppError from '../../../utils/AppError.js';
import { addDays, formatPktDate } from '../../../utils/dates.js';
import { recordAudit, type ActorContext } from '../../audit/audit.service.js';
import { statusLabel } from '../../orders/orderStatus.js';
import { getSettings } from '../../settings/settings.service.js';
import { cityKey, fetchPostexCities } from './postex.service.js';
import type { CancelBookingInput, LoadSheetInput } from './postex.validation.js';

// Phase 20B: book PostEx parcels, print airway bills and load sheets, cancel bookings.
//
// Booking happens OUTSIDE any database transaction: a transaction can be retried by MongoDB,
// and a retried PostEx call would create a second parcel. Instead the order is "claimed" with
// one atomic update (status "booking"), so a double click cannot book twice.
// If PostEx does not answer, the booking is marked "unknown"; the next attempt first looks in
// PostEx's list of new parcels for this order number before booking again.
export const BOOKING_PATHS = {
  createOrder: '/services/integration/api/order/v3/create-order',
  unbookedOrders: '/services/integration/api/order/v2/get-unbooked-orders',
  cancelOrder: '/services/integration/api/order/v1/cancel-order',
  airwayBill: '/services/integration/api/order/v1/getinvoice',
  loadSheet: '/services/integration/api/order/v2/generate-load-sheet',
} as const;

const STALE_BOOKING_MS = 2 * 60 * 1000; // a "booking" older than this means the server stopped mid-call
const MAX_LOAD_SHEET = 100;

async function findOrderOrThrow(idOrNumber: string): Promise<OrderDocument> {
  const filter = isValidObjectId(idOrNumber) ? { _id: idOrNumber } : { orderNumber: idOrNumber.trim().toUpperCase() };
  const order = await Order.findOne(filter);
  if (!order) throw new AppError('Order not found', 404);
  return order;
}

// +923001234567 -> 03001234567 (the format PostEx asks for)
export function postexPhone(stored: string): string {
  return `0${stored.replace(/^\+92/, '')}`;
}

function deliveryAddress(order: OrderDocument): string {
  const a = order.customerSnapshot.address;
  return [a.line1, a.line2, a.area, a.city].filter(Boolean).join(', ');
}

function orderDetail(order: OrderDocument): string {
  const text = order.items.map((i) => `${i.qty} x ${i.name} ${i.variantLabel}`).join(', ');
  return text.length > 500 ? `${text.slice(0, 499)}…` : text;
}

// Total shipping weight in kg (PostEx "bookingWeight"), from each size's shipping weight
async function weightKg(order: OrderDocument): Promise<number> {
  const filter: Record<string, unknown> = { _id: mongoose.trusted({ $in: order.items.map((i) => i.variant) }) };
  const variants = await Variant.find(filter).select('shippingWeightGrams').lean();
  const grams = order.items.reduce((sum, i) => {
    const v = variants.find((x) => String(x._id) === String(i.variant));
    return sum + (v?.shippingWeightGrams ?? 0) * i.qty;
  }, 0);
  return Math.max(0.01, Math.round(grams / 10) / 100);
}

// The PostEx spelling of the customer's city (matched in 20A)
async function postexCityName(order: OrderDocument): Promise<string> {
  const address = order.customerSnapshot.address;
  const city = address.cityRef ? await City.findById(address.cityRef).select('name postex').lean() : null;
  if (!city) {
    throw new AppError(`"${address.city}" is not in your city list. Correct the address first, or book in the PostEx portal and type the tracking number when shipping.`, 400);
  }
  if (!city.postex?.delivers || !city.postex.name) {
    throw new AppError(`PostEx does not deliver to ${city.name}, or the city is not matched yet. Match it on the PostEx page, or use another courier.`, 400);
  }
  return city.postex.name;
}

function bookingView(order: { orderNumber: string; fulfillment: { booking?: unknown } }) {
  return { orderNumber: order.orderNumber, booking: order.fulfillment.booking ?? null };
}

// After an unanswered attempt: did PostEx create the parcel anyway?
async function findEarlierParcel(order: OrderDocument, since: Date): Promise<string | null> {
  const result = await postexRequest<{ orderRefNumber?: string; trackingNumber?: string }[]>({
    method: 'GET',
    path: BOOKING_PATHS.unbookedOrders,
    query: { startDate: formatPktDate(addDays(since, -1)), endDate: formatPktDate(addDays(new Date(), 1)) },
    action: 'find_booking',
    order: { id: order._id, orderNumber: order.orderNumber },
    summary: 'look for an earlier booking',
  });
  const found = (Array.isArray(result.dist) ? result.dist : []).find(
    (p) => String(p.orderRefNumber ?? '').trim().toUpperCase() === order.orderNumber && p.trackingNumber
  );
  return found?.trackingNumber?.trim() ?? null;
}

async function markBooked(order: OrderDocument, trackingNumber: string, actor: ActorContext, foundEarlier: boolean) {
  const updated = await Order.findOneAndUpdate(
    { _id: order._id },
    {
      $set: { 'fulfillment.booking.status': 'booked', 'fulfillment.booking.trackingNumber': trackingNumber, 'fulfillment.booking.bookedAt': new Date() },
      $unset: { 'fulfillment.booking.error': '' },
    },
    { new: true }
  )
    .select('orderNumber fulfillment.booking')
    .lean();
  await recordAudit({
    admin: actor.adminId,
    action: 'postex.book',
    entityType: 'Order',
    entityId: order.id,
    after: { trackingNumber, foundEarlierBooking: foundEarlier },
    ip: actor.ip,
  });
  return { ...bookingView(updated!), foundEarlierBooking: foundEarlier };
}

// ── Book ──────────────────────────────────────────────

export async function bookParcel(idOrNumber: string, actor: ActorContext) {
  const order = await findOrderOrThrow(idOrNumber);
  if (order.status !== 'packing') {
    throw new AppError(`Book the PostEx parcel after packing (this order is "${statusLabel(order.status)}")`, 409);
  }
  if (!isPostexConfigured()) throw new AppError('PostEx is not set up. Add POSTEX_TOKEN to the server .env file.', 503);
  const settings = await getSettings();
  const pickupAddressCode = settings.postex?.pickupAddressCode;
  if (!pickupAddressCode) throw new AppError('Choose the PostEx pickup address first (PostEx page)', 400);

  const previous = order.fulfillment.booking;
  if (previous?.status === 'booked') throw new AppError(`Already booked with PostEx: ${previous.trackingNumber}`, 409);
  const stale = previous?.status === 'booking' && Date.now() - previous.attemptAt.getTime() > STALE_BOOKING_MS;
  if (previous?.status === 'booking' && !stale) {
    throw new AppError('A PostEx booking for this order is already in progress. Wait a minute, then refresh the order.', 409);
  }

  // The last attempt got no answer: look at PostEx before booking again, so we never book twice
  if (previous && (previous.status === 'unknown' || stale)) {
    const earlier = await findEarlierParcel(order, previous.attemptAt);
    if (earlier) return markBooked(order, earlier, actor, true);
  }

  const cityName = await postexCityName(order);
  const weight = await weightKg(order);
  const amount = order.payment.method === 'cod' ? order.pricing.total : 0; // what the rider collects

  // Claim the order: only succeeds if nobody changed the booking since we read it
  const attemptAt = new Date();
  const claimFilter: Record<string, unknown> = {
    _id: order._id,
    status: 'packing',
    'fulfillment.booking.attemptAt': previous ? previous.attemptAt : mongoose.trusted({ $exists: false }),
  };
  const claimed = await Order.findOneAndUpdate(claimFilter, {
    $set: { 'fulfillment.booking': { provider: 'postex', status: 'booking', attemptAt, weightKg: weight } },
  });
  if (!claimed) throw new AppError('This order changed while booking (another booking may have started). Refresh and try again.', 409);

  const returnAddressCode = settings.postex?.returnAddressCode;
  const payload = {
    orderRefNumber: order.orderNumber,
    invoicePayment: amount,
    orderDetail: orderDetail(order),
    customerName: order.customerSnapshot.name,
    customerPhone: postexPhone(order.customerSnapshot.phone),
    deliveryAddress: deliveryAddress(order),
    cityName,
    invoiceDivision: 1,
    items: order.items.reduce((sum, i) => sum + i.qty, 0),
    orderType: 'Normal',
    bookingWeight: weight,
    pickupAddressCode,
    ...(returnAddressCode ? { returnAddressCode } : {}),
  };

  const setResult = (status: 'failed' | 'unknown', error: string) =>
    Order.updateOne(
      { _id: order._id, 'fulfillment.booking.attemptAt': attemptAt },
      { $set: { 'fulfillment.booking.status': status, 'fulfillment.booking.error': error.slice(0, 500) } }
    );

  let trackingNumber: string | undefined;
  try {
    const result = await postexRequest<{ trackingNumber?: string }>({
      method: 'POST',
      path: BOOKING_PATHS.createOrder,
      body: payload,
      action: 'book_shipment',
      order: { id: order._id, orderNumber: order.orderNumber },
      summary: `${cityName}, ${weight} kg, Rs ${amount}`,
    });
    trackingNumber = result.dist?.trackingNumber?.trim();
  } catch (error) {
    const message = (error as Error).message;
    // 400 = PostEx answered and refused (wrong city, phone…): no parcel was created
    if (error instanceof AppError && error.statusCode === 400) {
      await setResult('failed', message);
      throw error;
    }
    await setResult('unknown', message);
    throw new AppError(
      `${message} PostEx may or may not have created the parcel. Press "Book with PostEx" again: it checks PostEx first, so the parcel is not booked twice.`,
      504
    );
  }

  if (!trackingNumber) {
    await setResult('unknown', 'PostEx answered without a tracking number');
    throw new AppError('PostEx answered without a tracking number. Press "Book with PostEx" again to check.', 502);
  }
  return markBooked(order, trackingNumber, actor, false);
}

// ── Cancel (before PostEx picks the parcel up) ────────

export async function cancelBooking(idOrNumber: string, input: CancelBookingInput, actor: ActorContext) {
  const order = await findOrderOrThrow(idOrNumber);
  const booking = order.fulfillment.booking;
  if (booking?.status === 'unknown' || booking?.status === 'booking') {
    throw new AppError('The last PostEx booking did not finish. Press "Book with PostEx" again to check it first.', 409);
  }
  if (booking?.status !== 'booked' || !booking.trackingNumber) throw new AppError('This order has no PostEx booking to cancel', 409);
  if (order.status !== 'packing') {
    throw new AppError(`The parcel is already with PostEx (order is "${statusLabel(order.status)}"). Cancel it in the PostEx portal or with PostEx support.`, 409);
  }

  await postexRequest({
    method: 'PUT',
    path: BOOKING_PATHS.cancelOrder,
    body: { trackingNumber: booking.trackingNumber },
    action: 'cancel_shipment',
    order: { id: order._id, orderNumber: order.orderNumber },
    summary: booking.trackingNumber,
    acceptHttpOk: true,
  });

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, 'fulfillment.booking.trackingNumber': booking.trackingNumber },
    { $set: { 'fulfillment.booking.status': 'cancelled', 'fulfillment.booking.cancelledAt': new Date(), 'fulfillment.booking.error': input.reason } },
    { new: true }
  )
    .select('orderNumber fulfillment.booking')
    .lean();
  await recordAudit({
    admin: actor.adminId,
    action: 'postex.cancel_booking',
    entityType: 'Order',
    entityId: order.id,
    before: { trackingNumber: booking.trackingNumber },
    after: { status: 'cancelled', reason: input.reason },
    ip: actor.ip,
  });
  return bookingView(updated ?? order);
}

// ── Airway bill (parcel label) and load sheet ─────────

export async function airwayBill(idOrNumber: string) {
  const order = await findOrderOrThrow(idOrNumber);
  const booked = order.fulfillment.booking?.status === 'booked' ? order.fulfillment.booking.trackingNumber : undefined;
  const tracking = booked ?? (order.fulfillment.courier === 'postex' ? order.fulfillment.trackingNumber : undefined);
  if (!tracking) throw new AppError('Book the parcel with PostEx first', 409);
  const pdf = await postexPdf({
    method: 'GET',
    path: BOOKING_PATHS.airwayBill,
    query: { trackingNumbers: tracking },
    action: 'airway_bill',
    order: { id: order._id, orderNumber: order.orderNumber },
    summary: tracking,
  });
  return { pdf, filename: `airway-bill-${order.orderNumber}.pdf` };
}

// For the PostEx rider at pickup. No list = every booked parcel still waiting (order in Packing).
export async function loadSheet(input: LoadSheetInput, actor: ActorContext) {
  const filter: Record<string, unknown> = { 'fulfillment.booking.status': 'booked' };
  if (input.orders?.length) filter.orderNumber = mongoose.trusted({ $in: input.orders.map((o) => o.toUpperCase()) });
  else filter.status = 'packing';
  const orders = await Order.find(filter).select('orderNumber fulfillment.booking.trackingNumber').sort({ createdAt: 1 }).limit(MAX_LOAD_SHEET + 1).lean();

  if (input.orders?.length) {
    const found = new Set(orders.map((o) => o.orderNumber));
    const missing = input.orders.map((o) => o.toUpperCase()).filter((o) => !found.has(o));
    if (missing.length) throw new AppError(`Not booked with PostEx: ${missing.slice(0, 10).join(', ')}`, 400);
  }
  if (orders.length === 0) throw new AppError('No booked PostEx parcels are waiting for pickup', 400);
  if (orders.length > MAX_LOAD_SHEET) throw new AppError(`At most ${MAX_LOAD_SHEET} parcels on one load sheet. Choose the orders.`, 400);

  const trackingNumbers = orders.map((o) => o.fulfillment.booking!.trackingNumber!);
  const pdf = await postexPdf({
    method: 'POST',
    path: BOOKING_PATHS.loadSheet,
    body: { trackingNumbers },
    action: 'load_sheet',
    summary: `${trackingNumbers.length} parcels`,
  });
  await recordAudit({ admin: actor.adminId, action: 'postex.load_sheet', entityType: 'Order', after: { orders: orders.map((o) => o.orderNumber) }, ip: actor.ip });
  return { pdf, filename: `postex-load-sheet-${formatPktDate(new Date())}.pdf` };
}

// ── City suggestions for the cities sync could not match ──

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

// 1 = same name, 0 = nothing alike. "Dera Ghazi Khan" vs "D.G Khan" is low, so short forms still need a hand match.
export function nameSimilarity(a: string, b: string): number {
  const x = cityKey(a);
  const y = cityKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) return 0.85;
  return 1 - editDistance(x, y) / Math.max(x.length, y.length);
}

export async function citySuggestions() {
  const postexCities = (await fetchPostexCities()).filter((c) => c.delivery);
  const filter: Record<string, unknown> = { 'postex.delivers': mongoose.trusted({ $ne: true }), 'postex.manual': mongoose.trusted({ $ne: true }) };
  const unmatched = await City.find(filter).select('name province').sort({ name: 1 }).limit(500).lean();

  const cities = unmatched.map((city) => ({
    id: String(city._id),
    name: city.name,
    province: city.province,
    // Closest PostEx spellings; an empty list usually means PostEx does not deliver there
    suggestions: postexCities
      .map((p) => ({ postexCityName: p.name, score: Math.round(nameSimilarity(city.name, p.name) * 100) / 100 }))
      .filter((s) => s.score >= 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
  }));
  return { unmatched: cities.length, withSuggestions: cities.filter((c) => c.suggestions.length > 0).length, cities };
}