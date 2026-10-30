import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as inventoryController from './inventory.controller.js';
import { adjustStockSchema, receiveBatchSchema, updateBatchSchema } from './inventory.validation.js';

// Batches of one size.
// Mounted inside the product admin routes at /:productId/variants/:variantId/batches,
// so it is already behind requireAdmin. mergeParams lets it read :productId and :variantId.
export const batchRoutes = Router({ mergeParams: true });

batchRoutes.get('/', inventoryController.listBatches);
batchRoutes.post('/', validateBody(receiveBatchSchema), inventoryController.receiveBatch);
batchRoutes.patch('/:batchId', validateBody(updateBatchSchema), inventoryController.updateBatch);
batchRoutes.post('/:batchId/adjust', validateBody(adjustStockSchema), inventoryController.adjustStock);

// Store-wide inventory: /api/admin/inventory
export const inventoryAdminRoutes = Router();

inventoryAdminRoutes.use(requireAdmin);

inventoryAdminRoutes.get('/movements', inventoryController.listMovements);
inventoryAdminRoutes.get('/alerts/expiry', inventoryController.expiryAlerts);
inventoryAdminRoutes.get('/alerts/low-stock', inventoryController.lowStockAlerts);