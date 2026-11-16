import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as promotionController from './promotion.controller.js';
import { createPromotionSchema, updatePromotionSchema } from './promotion.validation.js';

// Admin: /api/admin/promotions
export const promotionAdminRoutes = Router();

promotionAdminRoutes.use(requireAdmin);

promotionAdminRoutes.get('/', promotionController.list);
promotionAdminRoutes.post('/', validateBody(createPromotionSchema), promotionController.create);
promotionAdminRoutes.get('/:id', promotionController.get);
promotionAdminRoutes.patch('/:id', validateBody(updatePromotionSchema), promotionController.update);
promotionAdminRoutes.post('/:id/pause', promotionController.pause);
promotionAdminRoutes.post('/:id/resume', promotionController.resume);
promotionAdminRoutes.post('/:id/end', promotionController.end);