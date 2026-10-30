import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import env from '../../config/env.js';
import Admin, { type AdminDocument } from '../../models/Admin.js';
import AppError from '../../utils/AppError.js';
import { recordAudit } from '../audit/audit.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const INVALID_LOGIN = 'Invalid email or password';
const NOT_LOGGED_IN = 'Please log in to continue';

// Used when the email doesn't exist, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-equal-timing', 12);

export interface LoginResult {
  admin: AdminDocument;
  token: string;
  expiresAt: Date;
}

export async function login(email: string, password: string, ip?: string): Promise<LoginResult> {
  const admin = await Admin.findOne({ email }).select('+passwordHash');

  if (!admin || !admin.isActive) {
    await bcrypt.compare(password, DUMMY_HASH);
    await recordAudit({
      action: 'admin.login_failed',
      entityType: 'Admin',
      after: { email, reason: admin ? 'inactive' : 'unknown_email' },
      ip,
    });
    throw new AppError(INVALID_LOGIN, 401);
  }

  if (admin.lockUntil && admin.lockUntil > new Date()) {
    const minutesLeft = Math.ceil((admin.lockUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(
      `Account locked after too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      423
    );
  }

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);

  if (!passwordMatches) {
    admin.failedLoginCount += 1;
    const failedCount = admin.failedLoginCount;
    let locked = false;

    if (admin.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
      admin.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
      admin.failedLoginCount = 0;
      locked = true;
    }
    await admin.save();

    await recordAudit({
      admin: admin.id,
      action: 'admin.login_failed',
      entityType: 'Admin',
      entityId: admin.id,
      after: { reason: 'wrong_password', failedCount },
      ip,
    });

    if (locked) {
      await recordAudit({
        admin: admin.id,
        action: 'admin.locked',
        entityType: 'Admin',
        entityId: admin.id,
        after: { lockUntil: admin.lockUntil },
        ip,
      });
    }

    throw new AppError(INVALID_LOGIN, 401);
  }

  admin.failedLoginCount = 0;
  admin.lockUntil = undefined;
  admin.lastLoginAt = new Date();
  await admin.save();

  await recordAudit({
    admin: admin.id,
    action: 'admin.login',
    entityType: 'Admin',
    entityId: admin.id,
    ip,
  });

  const token = jwt.sign({ role: admin.role }, env.jwtSecret, {
    subject: admin.id,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });

  const decoded = jwt.decode(token) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000);

  return { admin, token, expiresAt };
}

export async function getAdminFromToken(token: string): Promise<AdminDocument> {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    throw new AppError('Your session has expired or is invalid. Please log in again', 401);
  }

  if (typeof payload.sub !== 'string') {
    throw new AppError(NOT_LOGGED_IN, 401);
  }

  const admin = await Admin.findById(payload.sub);
  if (!admin || !admin.isActive) {
    throw new AppError(NOT_LOGGED_IN, 401);
  }

  if (admin.passwordChangedAt && payload.iat !== undefined) {
    const changedAtSeconds = Math.floor(admin.passwordChangedAt.getTime() / 1000);
    if (changedAtSeconds > payload.iat) {
      throw new AppError('Your password was changed. Please log in again', 401);
    }
  }

  return admin;
}

export async function logout(token: string | undefined, ip?: string): Promise<void> {
  if (!token) return;

  try {
    const admin = await getAdminFromToken(token);
    await recordAudit({
      admin: admin.id,
      action: 'admin.logout',
      entityType: 'Admin',
      entityId: admin.id,
      ip,
    });
  } catch {
    // Token already invalid or expired: nothing to record, the cookie is cleared anyway.
  }
}