import type { CookieOptions } from 'express';
import env from '../../config/env.js';

export const ADMIN_COOKIE_NAME = 'admin_token';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  path: '/',
};

export function loginCookieOptions(expiresAt: Date): CookieOptions {
  return { ...baseOptions, expires: expiresAt };
}

export function logoutCookieOptions(): CookieOptions {
  return baseOptions;
}