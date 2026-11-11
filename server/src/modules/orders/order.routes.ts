import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as orderController from './order.controller.js';
import { cancelOrderSchema, logCallSchema, updateNotesSchema } from './order.validation.js';

// Admin: /api/admin/orders  (:id = database ID or order number)
export const orderAdminRoutes = Router();

orderAdminRoutes.use(requireAdmin);

orderAdminRoutes.get('/', orderController.list);
orderAdminRoutes.get('/:id', orderController.get);
orderAdminRoutes.post('/:id/calls', validateBody(logCallSchema), orderController.logCall);
orderAdminRoutes.post('/:id/cancel', validateBody(cancelOrderSchema), orderController.cancel);
orderAdminRoutes.patch('/:id/notes', validateBody(updateNotesSchema), orderController.updateNotes);