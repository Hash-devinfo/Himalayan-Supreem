import type { Request, Response } from 'express';
import * as checkoutService from './checkout.service.js';
import { CART_COOKIE_NAME, cartCookieOptions, readCartSessionId } from '../cart/cart.cookie.js';
import type { CheckoutInput } from './checkout.validation.js';

export async function placeOrder(req: Request, res: Response): Promise<void> {
  const sessionId = readCartSessionId(req.cookies?.[CART_COOKIE_NAME]);
  const order = await checkoutService.placeOrder(sessionId, req.body as CheckoutInput);

  // The cart is now an order: remove its cookie so the next visit starts a fresh cart
  const { maxAge: _maxAge, ...cookieOptions } = cartCookieOptions();
  res.clearCookie(CART_COOKIE_NAME, cookieOptions);

  res.status(201).json({ success: true, order });
}