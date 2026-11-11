import mongoose, { isValidObjectId, type Types } from 'mongoose';
import Cart, { type CartDocument } from '../../models/Cart.js';
import Variant from '../../models/Variant.js';
import Product from '../../models/Product.js';
import { CART_RETENTION_DAYS, MAX_CART_LINES, MAX_QTY_PER_ITEM } from '../../constants/cart.js';
import AppError from '../../utils/AppError.js';
import { addDays } from '../../utils/dates.js';
import { newCartSessionId } from './cart.cookie.js';
import { calculateDelivery, resolveCity, type DeliveryQuote } from '../delivery/quote.service.js';
import type { AddItemInput, DeliveryPreviewInput, UpdateItemInput } from './cart.validation.js';
// ── What the customer sees ───────────────────────────

export interface CartLine {
  variantId: string;
  productName: string;
  productSlug: string;
  image?: { url: string; alt: string };
  label: string;
  sku: string;
  price: number;
  quantity: number;
  lineTotal: number;
  inStock: boolean;
  maxQuantity: number; // the most the customer can choose right now
}

export interface CartNotice {
  type: 'removed' | 'quantity_reduced' | 'price_changed' | 'out_of_stock';
  variantId: string;
  message: string;
}

export interface CartView {
  items: CartLine[];
  notices: CartNotice[];
  itemCount: number; // units, in-stock lines only
  subtotal: number; // PKR, in-stock lines only
  weightGrams: number; // in-stock lines only
  canCheckout: boolean;
}

// A new empty cart view each time (never a shared object that could be changed by accident)
function emptyView(): CartView {
  return { items: [], notices: [], itemCount: 0, subtotal: 0, weightGrams: 0, canCheckout: false };
}

// ── Sellable sizes ────────────────────────────────────

interface SellableSize {
  id: string;
  label: string;
  sku: string;
  price: number;
  availableQty: number;
  shippingWeightGrams: number;
  productName: string;
  productSlug: string;
  image?: { url: string; alt: string };
}

// A size can be bought only if it is active AND its product is published.
async function loadSellable(variantIds: (string | Types.ObjectId)[]): Promise<Map<string, SellableSize>> {
  const result = new Map<string, SellableSize>();
  if (variantIds.length === 0) return result;

  const variantFilter: Record<string, unknown> = { _id: mongoose.trusted({ $in: variantIds }), status: 'active' };
  const variants = await Variant.find(variantFilter)
    .select('product label sku price availableQty shippingWeightGrams')
    .lean();

  const productFilter: Record<string, unknown> = {
    _id: mongoose.trusted({ $in: variants.map((v) => v.product) }),
    status: 'published',
  };
  const products = await Product.find(productFilter).select('name slug images').lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  for (const variant of variants) {
    const product = productById.get(String(variant.product));
    if (!product) continue;
    const firstImage = product.images[0];
    result.set(String(variant._id), {
      id: String(variant._id),
      label: variant.label,
      sku: variant.sku,
      price: variant.price,
      availableQty: variant.availableQty,
      shippingWeightGrams: variant.shippingWeightGrams,
      productName: product.name,
      productSlug: product.slug,
      image: firstImage ? { url: firstImage.url, alt: firstImage.alt } : undefined,
    });
  }
  return result;
}

function sellableOrThrow(sizes: Map<string, SellableSize>, variantId: string): SellableSize {
  const size = sizes.get(variantId);
  if (!size) throw new AppError('This product is no longer available', 400);
  return size;
}

// The quantity must fit both the stock and the per-size limit
function assertQuantityAllowed(size: SellableSize, quantity: number): void {
  if (size.availableQty <= 0) {
    throw new AppError(`${size.productName} (${size.label}) is out of stock`, 400);
  }
  if (quantity > size.availableQty) {
    throw new AppError(`Only ${size.availableQty} of ${size.productName} (${size.label}) left`, 400);
  }
  if (quantity > MAX_QTY_PER_ITEM) {
    throw new AppError(`You can order at most ${MAX_QTY_PER_ITEM} of one size`, 400);
  }
}

// ── Finding and saving carts ──────────────────────────

// Runs a cart change again with fresh data if another request changed the same cart first
async function withRetry<T>(action: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof mongoose.Error.VersionError)) throw error;
      if (attempt === 3) throw new AppError('Your cart was changed in another tab. Please try again.', 409);
    }
  }
}

export async function findActiveCart(sessionId: string | undefined): Promise<CartDocument | null> {
  if (!sessionId) return null;
  return Cart.findOne({ sessionId, status: 'active' });
}

function touch(cart: CartDocument): void {
  const now = new Date();
  cart.lastActivityAt = now;
  cart.expiresAt = addDays(now, CART_RETENTION_DAYS);
}

// A cart is only created when the first item is added (just looking creates nothing)
async function findOrCreateCart(sessionId: string | undefined): Promise<{ cart: CartDocument; sessionId: string }> {
  const existing = await findActiveCart(sessionId);
  if (existing) return { cart: existing, sessionId: existing.sessionId };

  const newId = newCartSessionId();
  const cart = new Cart({ sessionId: newId, items: [], expiresAt: addDays(new Date(), CART_RETENTION_DAYS) });
  return { cart, sessionId: newId };
}

// ── The live re-check ─────────────────────────────────

// Compares the cart with the current products, prices and stock, fixes what it must,
// and tells the customer what changed.
export async function buildCartView(cart: CartDocument | null): Promise<CartView> {
  if (!cart || cart.items.length === 0) return emptyView();

  const sizes = await loadSellable(cart.items.map((item) => item.variant));
  const items: CartLine[] = [];
  const notices: CartNotice[] = [];
  const keep: typeof cart.items = [];
  let changed = false;

  for (const item of cart.items) {
    const variantId = String(item.variant);
    const size = sizes.get(variantId);

    // 1. No longer sold: remove it
    if (!size) {
      notices.push({ type: 'removed', variantId, message: 'An item in your cart is no longer available and was removed' });
      changed = true;
      continue;
    }

    const name = `${size.productName} (${size.label})`;

    // 2. Price changed since the customer last saw it
    if (size.price !== item.lastSeenPrice) {
      notices.push({
        type: 'price_changed',
        variantId,
        message: `The price of ${name} changed from Rs ${item.lastSeenPrice} to Rs ${size.price}`,
      });
      item.lastSeenPrice = size.price;
      changed = true;
    }

    // 3. Stock: out of stock stays in the cart (marked), less stock reduces the quantity
    const maxQuantity = Math.min(size.availableQty, MAX_QTY_PER_ITEM);
    const inStock = maxQuantity > 0;
    if (!inStock) {
      notices.push({ type: 'out_of_stock', variantId, message: `${name} is out of stock. Remove it to continue to checkout.` });
    } else if (item.quantity > maxQuantity) {
      notices.push({
        type: 'quantity_reduced',
        variantId,
        message: `Only ${maxQuantity} of ${name} available. Your quantity was changed from ${item.quantity} to ${maxQuantity}.`,
      });
      item.quantity = maxQuantity;
      changed = true;
    }

    keep.push(item);
    items.push({
      variantId,
      productName: size.productName,
      productSlug: size.productSlug,
      image: size.image,
      label: size.label,
      sku: size.sku,
      price: size.price,
      quantity: item.quantity,
      lineTotal: size.price * item.quantity,
      inStock,
      maxQuantity,
    });
  }

  if (changed) {
    cart.items = keep;
    await cart.save();
  }

  const inStockLines = items.filter((line) => line.inStock);
  return {
    items,
    notices,
    itemCount: inStockLines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: inStockLines.reduce((sum, line) => sum + line.lineTotal, 0),
    weightGrams: inStockLines.reduce((sum, line) => sum + (sizes.get(line.variantId)?.shippingWeightGrams ?? 0) * line.quantity, 0),
    canCheckout: items.length > 0 && items.every((line) => line.inStock),
  };
}

// ── Actions ───────────────────────────────────────────

export interface CartResult {
  view: CartView;
  sessionId?: string; // set when the browser needs a (new) cart cookie
}

export async function getCart(sessionId: string | undefined): Promise<CartView> {
  return withRetry(async () => buildCartView(await findActiveCart(sessionId)));
}

// Adds to the cart. If the size is already there, the quantities are added together.
export async function addItem(sessionId: string | undefined, input: AddItemInput): Promise<CartResult> {
  return withRetry(() => addItemOnce(sessionId, input));
}

async function addItemOnce(sessionId: string | undefined, input: AddItemInput): Promise<CartResult> {
  const sizes = await loadSellable([input.variantId]);
  const size = sellableOrThrow(sizes, input.variantId);

  const { cart, sessionId: cartSessionId } = await findOrCreateCart(sessionId);
  const existing = cart.items.find((item) => String(item.variant) === input.variantId);
  const newQuantity = (existing?.quantity ?? 0) + input.quantity;
  assertQuantityAllowed(size, newQuantity);

  if (existing) {
    existing.quantity = newQuantity;
    existing.lastSeenPrice = size.price;
  } else {
    if (cart.items.length >= MAX_CART_LINES) {
      throw new AppError(`Your cart can hold at most ${MAX_CART_LINES} different items`, 400);
    }
    cart.items.push({ variant: new mongoose.Types.ObjectId(input.variantId), quantity: input.quantity, lastSeenPrice: size.price, addedAt: new Date() });
  }

  touch(cart);
  await cart.save();
  return { view: await buildCartView(cart), sessionId: cartSessionId };
}

// Sets the quantity of one size that is already in the cart
export async function updateItem(sessionId: string | undefined, variantId: string, input: UpdateItemInput): Promise<CartResult> {
  return withRetry(() => updateItemOnce(sessionId, variantId, input));
}

async function updateItemOnce(sessionId: string | undefined, variantId: string, input: UpdateItemInput): Promise<CartResult> {
  const cart = await findActiveCart(sessionId);
  const item = isValidObjectId(variantId) ? cart?.items.find((i) => String(i.variant) === variantId) : undefined;
  if (!cart || !item) throw new AppError('This item is not in your cart', 404);

  const sizes = await loadSellable([variantId]);
  const size = sellableOrThrow(sizes, variantId);
  assertQuantityAllowed(size, input.quantity);

  item.quantity = input.quantity;
  item.lastSeenPrice = size.price;
  touch(cart);
  await cart.save();
  return { view: await buildCartView(cart), sessionId: cart.sessionId };
}

// Removing something that is not there is not an error: the result is the same
export async function removeItem(sessionId: string | undefined, variantId: string): Promise<CartResult> {
  return withRetry(() => removeItemOnce(sessionId, variantId));
}

async function removeItemOnce(sessionId: string | undefined, variantId: string): Promise<CartResult> {
  const cart = await findActiveCart(sessionId);
  if (!cart) return { view: emptyView() };

  const before = cart.items.length;
  cart.items = cart.items.filter((item) => String(item.variant) !== variantId);
  if (cart.items.length !== before) {
    touch(cart);
    await cart.save();
  }
  return { view: await buildCartView(cart), sessionId: cart.sessionId };
}

export async function clearCart(sessionId: string | undefined): Promise<CartResult> {
  return withRetry(() => clearCartOnce(sessionId));
}

async function clearCartOnce(sessionId: string | undefined): Promise<CartResult> {
  const cart = await findActiveCart(sessionId);
  if (!cart) return { view: emptyView() };

  cart.items = [];
  touch(cart);
  await cart.save();
  return { view: emptyView(), sessionId: cart.sessionId };
}



// ── Delivery preview ──────────────────────────────────

export interface CartWithDelivery {
  cart: CartView;
  delivery: DeliveryQuote;
  total: number | null; // subtotal + delivery; null when the city cannot be delivered to
}

// The cart, re-checked, plus the delivery charge for the chosen city (the same rules as 7A).
// Only previews: nothing is saved, and the order total is worked out again at checkout.
export async function previewDelivery(sessionId: string | undefined, input: DeliveryPreviewInput): Promise<CartWithDelivery> {
  const cart = await getCart(sessionId);
  if (cart.itemCount === 0) {
    throw new AppError('Your cart is empty. Add something to see the delivery charge.', 400);
  }

  const city = await resolveCity(input);
  const delivery = await calculateDelivery(city, cart.weightGrams, cart.subtotal);
  const total = delivery.available ? cart.subtotal + delivery.charge : null;

  return { cart, delivery, total };
}