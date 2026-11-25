import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as settingsController from './settings.controller.js';
import { updateSettingsSchema } from './settings.validation.js';
import { imageUpload } from '../../middleware/imageUpload.js';
import * as logoController from './logo.controller.js';
import { MAX_LOGO_MB } from './logo.service.js';
// Admin: /api/admin/settings
export const settingsAdminRoutes = Router();

settingsAdminRoutes.use(requireAdmin);

settingsAdminRoutes.get('/', settingsController.get);
settingsAdminRoutes.patch('/', validateBody(updateSettingsSchema), settingsController.update);


// Store logo (multipart field "image")
settingsAdminRoutes.post('/logo', imageUpload(MAX_LOGO_MB), logoController.upload);
settingsAdminRoutes.delete('/logo', logoController.remove);

// Public: /api/store (name, logo, contact details for the website)
export const storePublicRoutes = Router();

storePublicRoutes.get('/', logoController.storeInfo);