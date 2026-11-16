import mongoose, { type ClientSession, type Types } from 'mongoose';
import type { CartDocument } from '../../models/Cart.js';
import Product from '../../models/Product.js';
import Promotion, { type PromotionDocument } from '../../models/Promotion.js';
import PromotionRedemption from '../../models/PromotionRedemption.js';
import Variant from '../../models/Variant.js';
import AppError from '../../utils/AppError.js';
import type { CartView } from '../cart/cart.service.js';
import { priceCart } from './discount.engine.js';
import { isLive, toRule } from './promotion.service.js';

const AUTOMATIC_TYPES = ['product', 'category', 'seasonal'];

function usedUp(promo: PromotionDocument): boolean {
  return promo.usageLimit !== undefined && promo.usageCount >= promo.usageLimit;
}

// A code customers can use right now: a live discount code that is not used up
export function isUsableCode(promo: PromotionDocument | null, now: Date = new Date()): promo is PromotionDocument {
  return Boolean(promo && promo.type === 'code' && isLive(promo, now) && !usedUp(promo));
}

// Automatic promotions running now
export async function liveAutomaticPromotions(now: Date = new Date()): Promise<PromotionDocument[]> {
  const filter: Record<string, unknown> = {
    status: 'active',
    type: mongoose.trusted({ $in: AUTOMATIC_TYPES }),
    startsAt: mongoose.trusted({ $lte: now }),
  };
  const promos = await Promotion.find(filter);
  return promos.filter((p) => isLive(p, now));
}

// Product and category of each size (promotions can target either)
async function productAndCategory(variantIds: string[]) {
  const variantFilter: Record<string, unknown> = { _id: mongoose.trusted({ $in: variantIds }) };
  const variants = await Variant.find(variantFilter).select('product').lean();
  const productFilter: Record<string, unknown> = { _id: mongoose.trusted({ $in: variants.map((v) => v.product) }) };
  const products = await Product.find(productFilter).select('category').lean();
  const categoryOf = new Map(products.map((p) => [String(p._id), String(p.category)]));
  return new Map(variants.map((v) => [String(v._id), { productId: String(v.product), categoryId: categoryOf.get(String(v.product)) ?? '' }]));
}

// Adds discounts to the cart view (called at the end of every cart re-check).
// A code that stopped working (paused, ended, expired, used up) is removed and the customer is told.
export async function applyPromotions(cart: CartDocument, view: CartView): Promise<CartView> {
  const now = new Date();
  const inStock = view.items.filter((l) => l.inStock);

  let codePromo: PromotionDocument | null = null;
  if (cart.promoCode) {
    codePromo = await Promotion.findOne({ code: cart.promoCode });
    if (!isUsableCode(codePromo, now)) {
      view.notices.push({ type: 'promotion_removed', variantId: '', message: `The code ${cart.promoCode} is no longer available and was removed` });
      cart.promoCode = undefined;
      await cart.save();
      codePromo = null;
    }
  }

  if (inStock.length === 0) return view;

  const [automatic, info] = await Promise.all([liveAutomaticPromotions(now), productAndCategory(inStock.map((l) => l.variantId))]);
  const priced = priceCart(
    inStock.map((l) => ({ variantId: l.variantId, ...(info.get(l.variantId) ?? { productId: '', categoryId: '' }), unitPrice: l.price, qty: l.quantity })),
    automatic.map(toRule),
    codePromo ? toRule(codePromo) : undefined
  );

  const byVariant = new Map(priced.lines.map((l) => [l.variantId, l]));
  for (const line of view.items) {
    const p = byVariant.get(line.variantId);
    if (!p) continue;
    line.discount = p.discount;
    line.lineTotal = p.lineTotal;
    line.promotionId = p.promotionId;
    line.promotionName = p.promotionName;
  }
  view.itemsTotal = priced.itemsTotal;
  view.discountTotal = priced.discountTotal;
  view.subtotal = priced.subtotal;
  view.promoCode =
    codePromo && priced.code
      ? { code: codePromo.code!, promotionId: codePromo.id, name: codePromo.name, applied: priced.code.applied, discount: priced.code.discount, message: priced.code.message }
      : null;
  return view;
}

// ── At checkout, inside the order transaction ─────────

// Records one use of the code for this order. Checked again inside the transaction, so two
// orders at the same moment cannot both take the last use (they conflict and one is retried).
export async function redeemCode(
  input: { promotionId: string; code: string; orderId: Types.ObjectId; orderNumber: string; phone: string; amount: number },
  session: ClientSession
): Promise<void> {
  const promo = await Promotion.findById(input.promotionId).session(session);
  const removeIt = 'Remove the code to place your order.';
  if (!isUsableCode(promo)) throw new AppError(`The code ${input.code} is no longer available. ${removeIt}`, 409);

  if (promo.perCustomerLimit !== undefined) {
    const used = await PromotionRedemption.countDocuments({ promotion: promo._id, customerPhone: input.phone, status: 'used' }).session(session);
    if (used >= promo.perCustomerLimit) {
      throw new AppError(`You have already used the code ${input.code}${promo.perCustomerLimit > 1 ? ` ${promo.perCustomerLimit} times` : ''}. ${removeIt}`, 409);
    }
  }

  await Promotion.updateOne({ _id: promo._id }, { $inc: { usageCount: 1 } }, { session });
  await PromotionRedemption.create(
    [{ promotion: promo._id, order: input.orderId, orderNumber: input.orderNumber, customerPhone: input.phone, amount: input.amount }],
    { session }
  );
}

// A cancelled order gives its code use back (so the customer may use it again)
export async function releaseCode(orderId: Types.ObjectId, session: ClientSession): Promise<void> {
  const redemption = await PromotionRedemption.findOneAndUpdate(
    { order: orderId, status: 'used' },
    { $set: { status: 'released' } },
    { session, returnDocument: 'after' }
  );
  if (redemption) {
    await Promotion.updateOne({ _id: redemption.promotion }, { $inc: { usageCount: -1 } }, { session });
  }
}