// Test data builders. Everything here is FICTIONAL test data, created in a throwaway database.
import mongoose from 'mongoose';
import Category from '../../src/models/Category.js';
import City from '../../src/models/City.js';
import DeliveryZone from '../../src/models/DeliveryZone.js';
import Order from '../../src/models/Order.js';
import Product from '../../src/models/Product.js';
import Variant, { type VariantDocument } from '../../src/models/Variant.js';
import Batch from '../../src/models/Batch.js';
import { addItem } from '../../src/modules/cart/cart.service.js';
import { placeOrder } from '../../src/modules/checkout/checkout.service.js';
import { checkoutSchema } from '../../src/modules/checkout/checkout.validation.js';
import { receiveBatch } from '../../src/modules/inventory/inventory.service.js';
import { receiveBatchSchema } from '../../src/modules/inventory/inventory.validation.js';
import { recalculateVariantStock } from '../../src/modules/inventory/stock.service.js';
import { logCall } from '../../src/modules/orders/order.service.js';
import { packOrder } from '../../src/modules/orders/packing.service.js';
import { deliverOrder, shipOrder } from '../../src/modules/orders/fulfillment.service.js';
import { getSettings } from '../../src/modules/settings/settings.service.js';

// A pretend admin for actions that need one
export const actor = { adminId: new mongoose.Types.ObjectId().toString() };

const DAY = 24 * 60 * 60 * 1000;

// A Pakistan date (YYYY-MM-DD) `days` from today, as the admin would type it
export function pktDay(days: number): string {
  return new Date(Date.now() + 5 * 60 * 60 * 1000 + days * DAY).toISOString().slice(0, 10);
}

// A different phone number for every order (the daily limit is per phone)
let phoneCount = 0;
export function nextPhone(): string {
  phoneCount += 1;
  return `0300${String(phoneCount).padStart(7, '0')}`;
}

let skuCount = 0;

// One category, one published product, a default delivery zone and Lahore
export async function createStore(opts: { deliveryCharge?: number } = {}) {
  await getSettings();
  const zone = await DeliveryZone.create({
    name: 'TEST Other cities',
    charge: opts.deliveryCharge ?? 250,
    estimateText: 'TEST 3-5 working days',
    isDefault: true,
    active: true,
  });
  const city = await City.create({ name: 'Lahore', province: 'Punjab' });
  const category = await Category.create({ name: 'TEST Dry Fruits', slug: 'test-dry-fruits' });
  const product = await Product.create({
    name: 'TEST Almonds (FICTIONAL)',
    slug: 'test-almonds',
    category: category._id,
    status: 'published',
  });
  return { zone, city, category, product, cityId: city.id as string };
}

// A size of the product, with its own price and stock
export async function createVariant(
  productId: mongoose.Types.ObjectId,
  opts: { label?: string; price?: number; costPrice?: number; weightGrams?: number } = {}
): Promise<VariantDocument> {
  skuCount += 1;
  return Variant.create({
    product: productId,
    sku: `TEST-${skuCount}`,
    label: opts.label ?? '250 g',
    sizeValue: 250,
    sizeUnit: 'g',
    price: opts.price ?? 1000,
    costPrice: opts.costPrice ?? 600,
    shippingWeightGrams: opts.weightGrams ?? 300,
  });
}

// Receives stock the normal way (same checks as the admin screen)
export async function receive(variant: VariantDocument, batchNumber: string, quantity: number, expiresInDays: number, unitCost?: number) {
  const input = receiveBatchSchema.parse({ batchNumber, quantity, expiryDate: pktDay(expiresInDays), unitCost });
  const { batch } = await receiveBatch(String(variant.product), variant.id, input, actor);
  return batch;
}

// A batch that is ALREADY close to expiry. The admin screen refuses to receive these,
// so it is written straight to the database (as if it was received months ago).
export async function oldBatch(variant: VariantDocument, batchNumber: string, quantity: number, expiresInDays: number) {
  const batch = await Batch.create({
    variant: variant._id,
    product: variant.product,
    batchNumber,
    quantityReceived: quantity,
    quantityRemaining: quantity,
    receivedDate: new Date(Date.now() - 300 * DAY),
    expiryDate: new Date(Date.now() + expiresInDays * DAY),
  });
  await recalculateVariantStock(variant._id);
  return batch;
}

// The customer's side: add to cart, then check out (guest, cash on delivery)
export async function addToCart(lines: { variant: VariantDocument; qty: number }[]): Promise<string> {
  let sessionId: string | undefined;
  for (const line of lines) {
    const result = await addItem(sessionId, { variantId: line.variant.id, quantity: line.qty });
    sessionId = result.sessionId ?? sessionId;
  }
  if (!sessionId) throw new Error('No cart was created');
  return sessionId;
}

export async function checkout(sessionId: string, cityId: string, phone = nextPhone()) {
  const input = checkoutSchema.parse({
    name: 'Test Customer (FICTIONAL)',
    phone,
    address: { line1: 'House 1, Street 1, TEST area', cityId },
  });
  return placeOrder(sessionId, input);
}

export async function order(lines: { variant: VariantDocument; qty: number }[], cityId: string, phone?: string) {
  return checkout(await addToCart(lines), cityId, phone);
}

// Order -> confirmed on call -> packed (suggested batches) -> shipped -> delivered
export async function deliveredOrder(lines: { variant: VariantDocument; qty: number }[], cityId: string) {
  const { orderNumber } = await order(lines, cityId);
  await logCall(orderNumber, { outcome: 'confirmed' }, actor);
  await packOrder(orderNumber, {}, actor);
  await shipOrder(orderNumber, { courier: 'tcs', trackingNumber: `TCS${Date.now()}${phoneCount}` }, actor);
  await deliverOrder(orderNumber, {}, actor);
  return orderNumber;
}

export async function stockOf(variant: VariantDocument) {
  const v = await Variant.findById(variant._id).lean();
  return { available: v!.availableQty, reserved: v!.reservedQty };
}

export async function batchLeft(batchId: string | mongoose.Types.ObjectId) {
  const b = await Batch.findById(batchId).lean();
  return b!.quantityRemaining;
}

export async function findOrder(orderNumber: string) {
  const found = await Order.findOne({ orderNumber });
  if (!found) throw new Error(`Order ${orderNumber} not found`);
  return found;
}