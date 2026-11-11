import { randomBytes } from 'node:crypto';
import type { CookieOptions } from 'express';
import env from '../../config/env.js';
import { CART_RETENTION_DAYS } from '../../constants/cart.js';

export const CART_COOKIE_NAME = 'cart_session';

// 24 random bytes -> 32 URL-safe characters. Impossible to guess another person's cart.
export function newCartSessionId(): string {
  return randomBytes(24).toString('base64url');
}

// Ignore cookies that are not in our format (edited or left over from something else)
export function readCartSessionId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/.test(value) ? value : undefined;
}

export function cartCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: CART_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  };
}