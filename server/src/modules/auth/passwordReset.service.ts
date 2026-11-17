import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import env from '../../config/env.js';
import { RESET_LINK_MINUTES } from '../../constants/auth.js';
import Admin from '../../models/Admin.js';
import { describeEmailError, isEmailConfigured, sendEmail } from '../../providers/notifications/email.js';
import AppError from '../../utils/AppError.js';
import { recordAudit } from '../audit/audit.service.js';

// Admin password reset by email (requirements 4.5, design: hashed, short-lived reset token).
// - The link holds a random token; only its SHA-256 hash is stored, so a database leak cannot be used to reset.
// - The link works once, for RESET_LINK_MINUTES. A new request replaces the old link.
// - The answer is the same whether or not the email belongs to an admin, and the email is sent in the
//   background, so nobody can use this form to find out the admin's email.
// - A reset logs out every old session (passwordChangedAt) and lifts a lock from wrong attempts.

export const FORGOT_PASSWORD_MESSAGE = 'If that email belongs to an admin, a reset link has been sent. It works for 30 minutes.';
const INVALID_LINK = 'This reset link is invalid or has expired. Please request a new one.';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function resetLink(token: string): string {
  return `${env.clientUrls[0] ?? ''}/admin/reset-password?token=${token}`;
}

// Never waits for the email server and never throws: failures are written to the audit log
function sendInBackground(adminId: string, kind: string, message: { to: string; subject: string; text: string }, ip?: string) {
  void sendEmail(message).catch((error: unknown) =>
    recordAudit({ admin: adminId, action: 'admin.email_failed', entityType: 'Admin', entityId: adminId, after: { kind, error: describeEmailError(error) }, ip }).catch(
      () => undefined
    )
  );
}

export async function requestPasswordReset(email: string, ip?: string): Promise<{ message: string }> {
  const admin = await Admin.findOne({ email });
  if (!admin || !admin.isActive) {
    await recordAudit({ action: 'admin.password_reset_requested', entityType: 'Admin', after: { email, result: 'unknown_email' }, ip });
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  if (!isEmailConfigured()) {
    // Only the server log and audit log say why: use "npm run reset-admin-password" until email is set up
    console.warn('Password reset requested, but email (SMTP) is not set up. Use: npm run reset-admin-password');
    await recordAudit({ admin: admin.id, action: 'admin.password_reset_requested', entityType: 'Admin', entityId: admin.id, after: { result: 'email_not_configured' }, ip });
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  const token = randomBytes(32).toString('base64url');
  admin.set({ resetTokenHash: hashToken(token), resetTokenExpires: new Date(Date.now() + RESET_LINK_MINUTES * 60_000) });
  await admin.save();
  await recordAudit({ admin: admin.id, action: 'admin.password_reset_requested', entityType: 'Admin', entityId: admin.id, after: { result: 'link_sent' }, ip });

  sendInBackground(
    admin.id,
    'password_reset_link',
    {
      to: admin.email,
      subject: 'Reset your admin password',
      text: [
        `Hello ${admin.name},`,
        '',
        'Someone asked to reset the password for your store admin account.',
        `To choose a new password, open this link within ${RESET_LINK_MINUTES} minutes:`,
        '',
        resetLink(token),
        '',
        'If you did not ask for this, ignore this email. Your password will not change.',
      ].join('\n'),
    },
    ip
  );
  return { message: FORGOT_PASSWORD_MESSAGE };
}

export async function resetPassword(token: string, password: string, ip?: string): Promise<{ message: string }> {
  const filter: Record<string, unknown> = {
    resetTokenHash: hashToken(token),
    resetTokenExpires: mongoose.trusted({ $gt: new Date() }),
    isActive: true,
  };
  const admin = await Admin.findOne(filter);
  if (!admin) throw new AppError(INVALID_LINK, 400);

  admin.passwordHash = await bcrypt.hash(password, 12);
  admin.passwordChangedAt = new Date(); // every session made with the old password stops working
  admin.failedLoginCount = 0; // a lock from wrong attempts is lifted
  admin.lockUntil = undefined;
  admin.set({ resetTokenHash: undefined, resetTokenExpires: undefined }); // the link works once
  await admin.save();

  await recordAudit({ admin: admin.id, action: 'admin.password_reset', entityType: 'Admin', entityId: admin.id, after: { via: 'email link' }, ip });

  sendInBackground(
    admin.id,
    'password_changed',
    {
      to: admin.email,
      subject: 'Your admin password was changed',
      text: [
        `Hello ${admin.name},`,
        '',
        'The password for your store admin account was just changed, and all devices were logged out.',
        'If this was not you, reset your password straight away with npm run reset-admin-password on the server.',
      ].join('\n'),
    },
    ip
  );
  return { message: 'Your password was changed. Please log in with the new password.' };
}