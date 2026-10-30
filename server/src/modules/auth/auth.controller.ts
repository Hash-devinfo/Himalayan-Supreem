import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import type { LoginInput } from './auth.validation.js';
import { ADMIN_COOKIE_NAME, loginCookieOptions, logoutCookieOptions } from './auth.cookie.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const { admin, token, expiresAt } = await authService.login(email, password, req.ip);

  res.cookie(ADMIN_COOKIE_NAME, token, loginCookieOptions(expiresAt));
  res.json({ success: true, admin });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token: unknown = req.cookies?.[ADMIN_COOKIE_NAME];

  await authService.logout(typeof token === 'string' ? token : undefined, req.ip);

  res.clearCookie(ADMIN_COOKIE_NAME, logoutCookieOptions());
  res.json({ success: true, message: 'Logged out' });
}

export function me(req: Request, res: Response): void {
  res.json({ success: true, admin: req.admin });
}