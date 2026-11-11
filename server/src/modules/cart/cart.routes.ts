import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import * as cartController from './cart.controller.js';
import { addItemSchema, deliveryPreviewSchema, updateItemSchema } from './cart.validation.js';
// Public: /api/cart (guests, identified by the cart cookie)
export const cartRoutes = Router();

cartRoutes.get('/', cartController.get);
cartRoutes.delete('/', cartController.clear);
cartRoutes.post('/items', validateBody(addItemSchema), cartController.addItem);
cartRoutes.patch('/items/:variantId', validateBody(updateItemSchema), cartController.updateItem);
cartRoutes.delete('/items/:variantId', cartController.removeItem);
cartRoutes.post('/delivery', validateBody(deliveryPreviewSchema), cartController.previewDelivery);