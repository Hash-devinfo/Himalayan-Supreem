import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as pageController from './page.controller.js';
import { updatePageSchema } from './page.validation.js';

// Public: /api/pages  (footer links, policy pages, checkout links)
export const pagePublicRoutes = Router();

pagePublicRoutes.get('/', pageController.publicList);
pagePublicRoutes.get('/:slug', pageController.publicGet);

// Admin: /api/admin/pages
export const pageAdminRoutes = Router();

pageAdminRoutes.use(requireAdmin);

pageAdminRoutes.get('/', pageController.list);
pageAdminRoutes.get('/:slug', pageController.get);
pageAdminRoutes.put('/:slug', validateBody(updatePageSchema), pageController.update);
pageAdminRoutes.post('/:slug/approve', pageController.approve);