import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import type { LoginInput } from './auth.validation.js';
import { ADMIN_COOKIE_NAME, loginCookieOptions, logoutCookieOptions } from './auth.cookie.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const { admin, token, expiresAt } = await authService.login(email, password);

  res.cookie(ADMIN_COOKIE_NAME, token, loginCookieOptions(expiresAt));
  res.json({ success: true, admin });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(ADMIN_COOKIE_NAME, logoutCookieOptions());
  res.json({ success: true, message: 'Logged out' });
}