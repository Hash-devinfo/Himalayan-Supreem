import Promotion from '../../models/Promotion.js';
import AppError from '../../utils/AppError.js';
import { buildCartView, findActiveCart, type CartResult } from '../cart/cart.service.js';
import { isUsableCode } from './cartPricing.js';

// The customer types a code in the cart. It is saved on the cart and checked again on every
// cart view and at checkout. If it does not apply yet (e.g. minimum order), the cart says why.
export async function applyPromoCode(sessionId: string | undefined, code: string): Promise<CartResult> {
  const cart = await findActiveCart(sessionId);
  if (!cart || cart.items.length === 0) throw new AppError('Add something to your cart before using a code', 400);

  const promo = await Promotion.findOne({ code });
  if (!isUsableCode(promo)) throw new AppError('This code is not valid or has expired', 400);

  cart.promoCode = promo.code;
  await cart.save();
  return { view: await buildCartView(cart), sessionId: cart.sessionId };
}

export async function removePromoCode(sessionId: string | undefined): Promise<CartResult> {
  const cart = await findActiveCart(sessionId);
  if (!cart) throw new AppError('Your cart is empty', 400);
  if (cart.promoCode) {
    cart.promoCode = undefined;
    await cart.save();
  }
  return { view: await buildCartView(cart), sessionId: cart.sessionId };
}