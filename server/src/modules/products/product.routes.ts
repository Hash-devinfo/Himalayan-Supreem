import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as productController from './product.controller.js';
import * as variantController from './variant.controller.js';
import * as publicController from './product.public.controller.js';
import { batchRoutes } from '../inventory/inventory.routes.js';
import {
  changeProductStatusSchema,
  createProductSchema,
  updateProductSchema,
} from './product.validation.js';
import {
  changeVariantStatusSchema,
  createVariantSchema,
  updateVariantSchema,
} from './variant.validation.js';

// Public: /api/products
export const productPublicRoutes = Router();

productPublicRoutes.get('/', publicController.list);
productPublicRoutes.get('/filters', publicController.filters);
productPublicRoutes.get('/:slug', publicController.getBySlug);

// Admin: /api/admin/products (every route needs a logged-in admin)
export const productAdminRoutes = Router();

productAdminRoutes.use(requireAdmin);

// Products
productAdminRoutes.get('/', productController.listAdmin);
productAdminRoutes.post('/', validateBody(createProductSchema), productController.create);
productAdminRoutes.get('/:id', productController.getById);
productAdminRoutes.patch('/:id', validateBody(updateProductSchema), productController.update);
productAdminRoutes.patch(
  '/:id/status',
  validateBody(changeProductStatusSchema),
  productController.changeStatus
);

// Sizes (variants) of one product
productAdminRoutes.get('/:productId/variants', variantController.list);
productAdminRoutes.post(
  '/:productId/variants',
  validateBody(createVariantSchema),
  variantController.create
);
productAdminRoutes.patch(
  '/:productId/variants/:variantId',
  validateBody(updateVariantSchema),
  variantController.update
);
productAdminRoutes.patch(
  '/:productId/variants/:variantId/status',
  validateBody(changeVariantStatusSchema),
  variantController.changeStatus
);

// Batches (stock) of one size
productAdminRoutes.use('/:productId/variants/:variantId/batches', batchRoutes);