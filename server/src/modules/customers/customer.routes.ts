import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as customerController from './customer.controller.js';
import { blockCustomerSchema, unblockCustomerSchema } from './customer.validation.js';

// Admin: /api/admin/customers  (:phone = 03001234567 or +923001234567)
export const customerAdminRoutes = Router();

customerAdminRoutes.use(requireAdmin);

customerAdminRoutes.get('/', customerController.list);
customerAdminRoutes.get('/:phone', customerController.get);
customerAdminRoutes.post('/:phone/block', validateBody(blockCustomerSchema), customerController.block);
customerAdminRoutes.post('/:phone/unblock', validateBody(unblockCustomerSchema), customerController.unblock);