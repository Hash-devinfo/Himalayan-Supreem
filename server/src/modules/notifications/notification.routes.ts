import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as notificationController from './notification.controller.js';
import { previewTemplateSchema, updateTemplateSchema } from './templates.validation.js';

// Admin: /api/admin/notifications
export const notificationAdminRoutes = Router();

notificationAdminRoutes.use(requireAdmin);

notificationAdminRoutes.get('/templates', notificationController.listTemplates);
notificationAdminRoutes.put('/templates/:key', validateBody(updateTemplateSchema), notificationController.updateTemplate);
notificationAdminRoutes.post('/templates/:key/preview', validateBody(previewTemplateSchema), notificationController.previewTemplate);