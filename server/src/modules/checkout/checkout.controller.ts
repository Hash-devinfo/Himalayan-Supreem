import type { Request, Response } from 'express';
import * as checkoutService from './checkout.service.js';
import { CART_COOKIE_NAME, cartCookieOptions, readCartSessionId } from '../cart/cart.cookie.js';
import type { CheckoutInput } from './checkout.validation.js';
import { track } from '../analytics/analytics.service.js';
import { availablePaymentMethods } from '../../providers/payments/index.js';

export async function placeOrder(req: Request, res: Response): Promise<void> {
  const sessionId = readCartSessionId(req.cookies?.[CART_COOKIE_NAME]);
  const order = await checkoutService.placeOrder(sessionId, req.body as CheckoutInput);
  track(req, { type: 'order_completed', orderNumber: order.orderNumber });
  // The cart is now an order: remove its cookie so the next visit starts a fresh cart
  const { maxAge: _maxAge, ...cookieOptions } = cartCookieOptions();
  res.clearCookie(CART_COOKIE_NAME, cookieOptions);

  res.status(201).json({ success: true, order });
}


// Public: the payment methods the checkout page should offer
export function paymentMethods(_req: Request, res: Response): void {
  res.json({ success: true, methods: availablePaymentMethods() });
}