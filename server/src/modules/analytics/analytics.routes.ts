import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import * as analyticsController from './analytics.controller.js';
import { trackEventSchema } from './analytics.validation.js';

// Public: /api/analytics (anonymous events from the storefront)
export const analyticsPublicRoutes = Router();

analyticsPublicRoutes.post('/events', validateBody(trackEventSchema), analyticsController.trackEvent);