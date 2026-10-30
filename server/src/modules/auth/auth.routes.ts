import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { loginLimiter } from '../../middleware/rateLimiters.js';
import { validateBody } from '../../middleware/validate.js';
import { loginSchema } from './auth.validation.js';
import * as authController from './auth.controller.js';

const router = Router();

router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAdmin, authController.me);

export default router;