import { Router } from 'express';
import { checkoutLimiter } from '../../middleware/rateLimiters.js';
import { validateBody } from '../../middleware/validate.js';
import * as checkoutController from './checkout.controller.js';
import { checkoutSchema } from './checkout.validation.js';

// Public: /api/checkout (guest checkout, cash on delivery)
export const checkoutRoutes = Router();

checkoutRoutes.post('/', checkoutLimiter, validateBody(checkoutSchema), checkoutController.placeOrder);