import type { Request, Response } from 'express';
import * as cartService from './cart.service.js';
import { CART_COOKIE_NAME, cartCookieOptions, readCartSessionId } from './cart.cookie.js';
import type { AddItemInput, UpdateItemInput } from './cart.validation.js';

type VariantParams = { variantId: string };

function sessionFrom(req: Request): string | undefined {
  return readCartSessionId(req.cookies?.[CART_COOKIE_NAME]);
}

// Sets (or refreshes) the cart cookie, so it lasts as long as the cart does
function sendCart(res: Response, result: cartService.CartResult, status = 200): void {
  if (result.sessionId) res.cookie(CART_COOKIE_NAME, result.sessionId, cartCookieOptions());
  res.status(status).json({ success: true, cart: result.view });
}

export async function get(req: Request, res: Response): Promise<void> {
  const cart = await cartService.getCart(sessionFrom(req));
  res.json({ success: true, cart });
}

export async function addItem(req: Request, res: Response): Promise<void> {
  const result = await cartService.addItem(sessionFrom(req), req.body as AddItemInput);
  sendCart(res, result, 201);
}

export async function updateItem(req: Request<VariantParams>, res: Response): Promise<void> {
  const result = await cartService.updateItem(sessionFrom(req), req.params.variantId, req.body as UpdateItemInput);
  sendCart(res, result);
}

export async function removeItem(req: Request<VariantParams>, res: Response): Promise<void> {
  const result = await cartService.removeItem(sessionFrom(req), req.params.variantId);
  sendCart(res, result);
}

export async function clear(req: Request, res: Response): Promise<void> {
  const result = await cartService.clearCart(sessionFrom(req));
  sendCart(res, result);
}