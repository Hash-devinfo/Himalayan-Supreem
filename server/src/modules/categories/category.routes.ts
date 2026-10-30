import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as categoryController from './category.controller.js';
import {
  changeCategoryStatusSchema,
  createCategorySchema,
  updateCategorySchema,
} from './category.validation.js';

// Public: /api/categories
export const categoryPublicRoutes = Router();

categoryPublicRoutes.get('/', categoryController.listPublic);
categoryPublicRoutes.get('/:slug', categoryController.getPublicBySlug);

// Admin: /api/admin/categories (every route needs a logged-in admin)
export const categoryAdminRoutes = Router();

categoryAdminRoutes.use(requireAdmin);

categoryAdminRoutes.get('/', categoryController.listAdmin);
categoryAdminRoutes.get('/:id', categoryController.getById);
categoryAdminRoutes.post('/', validateBody(createCategorySchema), categoryController.create);
categoryAdminRoutes.patch('/:id', validateBody(updateCategorySchema), categoryController.update);
categoryAdminRoutes.patch(
  '/:id/status',
  validateBody(changeCategoryStatusSchema),
  categoryController.changeStatus
);