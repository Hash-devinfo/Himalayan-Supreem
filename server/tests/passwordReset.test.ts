import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Email is replaced by a fake that keeps the messages, so no real email is ever sent
const sent: { to: string; subject: string; text: string }[] = [];
let emailOn = true;
vi.mock('../src/providers/notifications/email.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/providers/notifications/email.js')>();
  return {
    ...real,
    isEmailConfigured: () => emailOn,
    sendEmail: async (message: { to: string; subject: string; text: string }) => {
      sent.push(message);
      return 'test-message-id';
    },
  };
});

const { default: app } = await import('../src/app.js');
const { default: Admin } = await import('../src/models/Admin.js');
const { default: AuditLog } = await import('../src/models/AuditLog.js');
const { login, getAdminFromToken } = await import('../src/modules/auth/auth.service.js');
const { requestPasswordReset, resetPassword, FORGOT_PASSWORD_MESSAGE } = await import('../src/modules/auth/passwordReset.service.js');
const { resetPasswordSchema } = await import('../src/modules/auth/auth.validation.js');

const EMAIL = 'admin.test@example.com'; // FICTIONAL
const OLD = 'old-password-123';
const NEW = 'new-password-456';

async function createAdmin() {
  return Admin.create({ name: 'Test Admin (FICTIONAL)', email: EMAIL, passwordHash: await bcrypt.hash(OLD, 4) });
}

// The token from the link in the last email
function tokenFromEmail(): string {
  const match = sent.at(-1)?.text.match(/reset-password\?token=([A-Za-z0-9_-]{43})/);
  if (!match) throw new Error('No reset link in the email');
  return match[1]!;
}

beforeEach(() => {
  sent.length = 0;
  emailOn = true;
});

describe('Forgot password', () => {
  it('sends a link to the admin; only a hash of the token is stored', async () => {
    await createAdmin();
    const result = await requestPasswordReset(EMAIL);
    expect(result.message).toBe(FORGOT_PASSWORD_MESSAGE);
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(sent[0]).toMatchObject({ to: EMAIL, subject: 'Reset your admin password' });
    const token = tokenFromEmail();
    const saved = await Admin.findOne({ email: EMAIL }).select('+resetTokenHash +resetTokenExpires');
    expect(saved!.resetTokenHash).toBeDefined();
    expect(saved!.resetTokenHash).not.toContain(token);
  });

  it('an unknown email gets the same answer and no email is sent', async () => {
    await createAdmin();
    const result = await requestPasswordReset('nobody@example.com');
    expect(result.message).toBe(FORGOT_PASSWORD_MESSAGE);
    await new Promise((r) => setTimeout(r, 50));
    expect(sent).toHaveLength(0);
  });

  it('without email set up: same answer, nothing sent, the reason is in the audit log', async () => {
    await createAdmin();
    emailOn = false;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await requestPasswordReset(EMAIL)).message).toBe(FORGOT_PASSWORD_MESSAGE);
    expect(sent).toHaveLength(0);
    expect(await AuditLog.countDocuments({ action: 'admin.password_reset_requested', 'after.result': 'email_not_configured' })).toBe(1);
    warn.mockRestore();
  });
});

describe('Reset password with the link', () => {
  it('sets the new password, logs out old sessions, and the link works once', async () => {
    await createAdmin();
    const oldSession = await login(EMAIL, OLD);
    await requestPasswordReset(EMAIL);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const token = tokenFromEmail();

    await new Promise((r) => setTimeout(r, 1100)); // the old login is from an earlier second
    await resetPassword(token, NEW);

    await expect(login(EMAIL, OLD)).rejects.toThrow('Invalid email or password');
    await expect(login(EMAIL, NEW)).resolves.toBeDefined();
    await expect(getAdminFromToken(oldSession.token)).rejects.toThrow(/password was changed/);
    await expect(resetPassword(token, 'another-password-789')).rejects.toThrow(/invalid or has expired/);

    await vi.waitFor(() => expect(sent.at(-1)?.subject).toBe('Your admin password was changed'));
    expect(await AuditLog.countDocuments({ action: 'admin.password_reset' })).toBe(1);
  });

  it('an expired link does not work', async () => {
    await createAdmin();
    await requestPasswordReset(EMAIL);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await Admin.updateOne({ email: EMAIL }, { $set: { resetTokenExpires: new Date(Date.now() - 1000) } });

    await expect(resetPassword(tokenFromEmail(), NEW)).rejects.toThrow(/invalid or has expired/);
  });

  it('a new request replaces the old link', async () => {
    await createAdmin();
    await requestPasswordReset(EMAIL);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const first = tokenFromEmail();
    await requestPasswordReset(EMAIL);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    await expect(resetPassword(first, NEW)).rejects.toThrow(/invalid or has expired/);
    await expect(resetPassword(tokenFromEmail(), NEW)).resolves.toBeDefined();
  });

  it('a reset also lifts a lock from wrong passwords', async () => {
    await createAdmin();
    await Admin.updateOne({ email: EMAIL }, { $set: { lockUntil: new Date(Date.now() + 15 * 60_000) } });
    await requestPasswordReset(EMAIL);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await resetPassword(tokenFromEmail(), NEW);
    await expect(login(EMAIL, NEW)).resolves.toBeDefined();
  });

  it('password rules: 12 to 72 characters, typed twice the same', () => {
    const token = 'a'.repeat(43);
    expect(resetPasswordSchema.safeParse({ token, password: 'short', confirmPassword: 'short' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token, password: NEW, confirmPassword: 'different-123' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token, password: NEW, confirmPassword: NEW }).success).toBe(true);
  });

  it('HTTP: both routes work without login; the answers give nothing away', async () => {
    await createAdmin();
    const known = await request(app).post('/api/admin/auth/forgot-password').send({ email: EMAIL });
    const unknown = await request(app).post('/api/admin/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(known.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const reset = await request(app)
      .post('/api/admin/auth/reset-password')
      .send({ token: tokenFromEmail(), password: NEW, confirmPassword: NEW });
    expect(reset.status).toBe(200);
  });
});