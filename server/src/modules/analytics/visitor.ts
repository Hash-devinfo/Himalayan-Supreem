import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import env from '../../config/env.js';
import { VISITOR_COOKIE_DAYS } from '../../constants/analytics.js';

export const VISITOR_COOKIE_NAME = 'visitor_id';

// Gives each browser a random, anonymous ID (no personal data), so analytics can link
// a product view to a later add-to-cart and order. Used on the public storefront routes only.
export function visitorCookie(req: Request, res: Response, next: NextFunction): void {
  const existing = req.cookies?.[VISITOR_COOKIE_NAME];
  const id = typeof existing === 'string' && /^[A-Za-z0-9_-]{22}$/.test(existing) ? existing : randomBytes(16).toString('base64url');
  req.visitorId = id;
  if (id !== existing) {
    res.cookie(VISITOR_COOKIE_NAME, id, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: VISITOR_COOKIE_DAYS * 24 * 60 * 60 * 1000,
    });
  }
  next();
}