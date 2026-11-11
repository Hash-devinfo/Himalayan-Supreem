import { z } from 'zod';
import { MAX_QTY_PER_ITEM } from '../../constants/cart.js';
import { objectId } from '../../utils/zodHelpers.js';
import { PROVINCES } from '../../constants/enums.js';



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


// Delivery preview: the same two ways to choose a city as the delivery quote
export const deliveryPreviewSchema = z
  .strictObject({
    cityId: objectId('City').optional(),
    cityName: z.string().trim().min(2, 'City name must be at least 2 characters').max(60, 'City name cannot be longer than 60 characters').optional(),
    province: z.enum(PROVINCES, `Province must be one of: ${PROVINCES.join(', ')}`).optional(),
  })
  .refine((data) => Boolean(data.cityId) !== Boolean(data.cityName && data.province), {
    message: 'Choose a city from the list, or type your city and choose its province',
    path: ['cityId'],
  });

export type DeliveryPreviewInput = z.infer<typeof deliveryPreviewSchema>;