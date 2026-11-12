import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as refundController from './refund.controller.js';
import { createRefundSchema, payRefundSchema, rejectRefundSchema } from './refund.validation.js';

// Admin: /api/admin/refunds
export const refundAdminRoutes = Router();

refundAdminRoutes.use(requireAdmin);

refundAdminRoutes.get('/', refundController.list);
refundAdminRoutes.post('/', validateBody(createRefundSchema), refundController.create);
refundAdminRoutes.get('/:id', refundController.get);
refundAdminRoutes.post('/:id/approve', refundController.approve);
refundAdminRoutes.post('/:id/reject', validateBody(rejectRefundSchema), refundController.reject);
refundAdminRoutes.post('/:id/pay', validateBody(payRefundSchema), refundController.pay);