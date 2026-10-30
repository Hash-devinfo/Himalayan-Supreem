import type { NextFunction, Request, Response } from 'express';
import AppError from '../utils/AppError.js';
import { ADMIN_COOKIE_NAME } from '../modules/auth/auth.cookie.js';
import { getAdminFromToken } from '../modules/auth/auth.service.js';

export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[ADMIN_COOKIE_NAME];

  if (typeof token !== 'string' || token === '') {
    throw new AppError('Please log in to continue', 401);
  }

  req.admin = await getAdminFromToken(token);
  next();
}