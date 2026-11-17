import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { loginLimiter, passwordResetLimiter } from '../../middleware/rateLimiters.js';
import { validateBody } from '../../middleware/validate.js';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from './auth.validation.js';
import * as authController from './auth.controller.js';

const router = Router();

router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAdmin, authController.me);
router.post('/forgot-password', passwordResetLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validateBody(resetPasswordSchema), authController.resetPassword);

export default router;