import { z } from 'zod';
import { objectId } from '../../utils/zodHelpers.js';

const allocation = z.strictObject({
  batchId: objectId('Batch'),
  qty: z.number('Quantity must be a number').int('Quantity must be a whole number').min(1, 'Quantity must be at least 1'),
});

// Send nothing (or {}) to pack with the suggested batches (earliest expiry first).
// Or choose: one entry per order item, with the batches and how many from each.
export const packOrderSchema = z
  .strictObject({
    items: z
      .array(
        z.strictObject({
          variantId: objectId('Product size'),
          allocations: z.array(allocation).min(1, 'Choose at least one batch').max(10, 'At most 10 batches per item'),
        })
      )
      .min(1)
      .optional(),
  })
  // No body at all = use the suggested batches
  .default({});

export const unpackOrderSchema = z.strictObject({
  reason: z.string('Reason is required').trim().min(3, 'Write why packing is being undone').max(500),
});

export type PackOrderInput = z.infer<typeof packOrderSchema>;
export type UnpackOrderInput = z.infer<typeof unpackOrderSchema>;