import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as deliveryController from './delivery.controller.js';
import { assignZoneSchema, createCitySchema, createZoneSchema, updateCitySchema, updateZoneSchema } from './delivery.validation.js';

// Admin: /api/admin/delivery
export const deliveryAdminRoutes = Router();

deliveryAdminRoutes.use(requireAdmin);

deliveryAdminRoutes.get('/zones', deliveryController.listZones);
deliveryAdminRoutes.post('/zones', validateBody(createZoneSchema), deliveryController.createZone);
deliveryAdminRoutes.patch('/zones/:id', validateBody(updateZoneSchema), deliveryController.updateZone);
deliveryAdminRoutes.post('/zones/:id/make-default', deliveryController.makeDefaultZone);

deliveryAdminRoutes.get('/cities', deliveryController.listCities);
deliveryAdminRoutes.post('/cities', validateBody(createCitySchema), deliveryController.createCity);
// Before /cities/:id, so "assign-zone" is not read as a city ID
deliveryAdminRoutes.post('/cities/assign-zone', validateBody(assignZoneSchema), deliveryController.assignZone);
deliveryAdminRoutes.patch('/cities/:id', validateBody(updateCitySchema), deliveryController.updateCity);