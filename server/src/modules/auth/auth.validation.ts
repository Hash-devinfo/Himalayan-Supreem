import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../constants/auth.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ── Password reset by email ──

export const forgotPasswordSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
});

export const resetPasswordSchema = z
  .strictObject({
    token: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, 'This reset link is invalid or has expired. Please request a new one.'),
    password: z
      .string('Enter a new password')
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
    confirmPassword: z.string('Type the new password again'),
  })
  .refine((data) => data.password === data.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;