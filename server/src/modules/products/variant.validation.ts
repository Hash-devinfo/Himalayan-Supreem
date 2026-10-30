import { z } from 'zod';
import { SIZE_UNITS, VARIANT_STATUSES } from '../../constants/enums.js';
import { rupees } from '../../utils/zodHelpers.js';

const wholeCount = (label: string) =>
  z
    .number(`${label} must be a number`)
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`);

export const createVariantSchema = z.strictObject({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'SKU can only contain letters, numbers and hyphens')
    .max(40, 'SKU cannot be longer than 40 characters'),
  label: z.string().trim().min(1, 'Label is required').max(40, 'Label cannot be longer than 40 characters'),
  sizeValue: z.number('Size value must be a number').positive('Size value must be greater than 0'),
  sizeUnit: z.enum(SIZE_UNITS, 'Size unit must be g, kg, ml, l or pcs'),
  price: rupees('Price'),
  costPrice: rupees('Cost price').optional(),
  shippingWeightGrams: wholeCount('Shipping weight').min(1, 'Shipping weight must be at least 1 gram'),
  lowStockThreshold: wholeCount('Low stock threshold').optional(),
  sortOrder: wholeCount('Sort order').max(9999).optional(),
});

export const updateVariantSchema = createVariantSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const changeVariantStatusSchema = z.strictObject({
  status: z.enum(VARIANT_STATUSES, 'Status must be active, unavailable or archived'),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type ChangeVariantStatusInput = z.infer<typeof changeVariantStatusSchema>;