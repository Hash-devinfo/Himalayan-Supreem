import { z } from 'zod';
import { MAX_QTY_PER_ITEM } from '../../constants/cart.js';
import { objectId } from '../../utils/zodHelpers.js';

const quantity = z
  .number('Quantity must be a number')
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(MAX_QTY_PER_ITEM, `You can order at most ${MAX_QTY_PER_ITEM} of one size`);

export const addItemSchema = z.strictObject({
  variantId: objectId('Product size'),
  quantity: quantity.default(1),
});

export const updateItemSchema = z.strictObject({ quantity });

export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;