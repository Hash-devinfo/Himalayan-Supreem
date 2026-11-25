import { Router } from 'express';
import { requireAdmin } from '../../../middleware/requireAdmin.js';
import { validateBody } from '../../../middleware/validate.js';
import * as postexController from './postex.controller.js';
import { matchCitySchema, postexSettingsSchema } from './postex.validation.js';

// Admin: /api/admin/integrations/postex
export const postexAdminRoutes = Router();

postexAdminRoutes.use(requireAdmin);

postexAdminRoutes.get('/', postexController.status);
postexAdminRoutes.post('/check', postexController.check);
postexAdminRoutes.patch('/settings', validateBody(postexSettingsSchema), postexController.updateSettings);
postexAdminRoutes.post('/sync-cities', postexController.syncCities);
postexAdminRoutes.patch('/cities/:cityId', validateBody(matchCitySchema), postexController.matchCity);
postexAdminRoutes.get('/logs', postexController.logs);