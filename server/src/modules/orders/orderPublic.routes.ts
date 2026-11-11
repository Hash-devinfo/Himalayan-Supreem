import { Router } from 'express';
import { orderLookupLimiter } from '../../middleware/rateLimiters.js';
import { validateBody } from '../../middleware/validate.js';
import * as orderPublicController from './orderPublic.controller.js';
import { lookupOrderSchema, requestCancellationSchema } from './orderPublic.validation.js';

// Public: /api/orders (customers, no login: order number + phone)
export const orderPublicRoutes = Router();

orderPublicRoutes.use(orderLookupLimiter);

orderPublicRoutes.post('/lookup', validateBody(lookupOrderSchema), orderPublicController.lookup);
orderPublicRoutes.post('/cancel-request', validateBody(requestCancellationSchema), orderPublicController.requestCancellation);