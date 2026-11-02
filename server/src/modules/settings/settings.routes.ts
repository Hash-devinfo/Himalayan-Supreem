import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as settingsController from './settings.controller.js';
import { updateSettingsSchema } from './settings.validation.js';

// Admin: /api/admin/settings
export const settingsAdminRoutes = Router();

settingsAdminRoutes.use(requireAdmin);

settingsAdminRoutes.get('/', settingsController.get);
settingsAdminRoutes.patch('/', validateBody(updateSettingsSchema), settingsController.update);