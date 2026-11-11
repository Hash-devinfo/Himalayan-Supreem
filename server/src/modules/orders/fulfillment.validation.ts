import { z } from 'zod';
import { COURIERS, DELIVERY_FAILURE_REASONS, RETURN_DECISIONS } from '../../constants/enums.js';
import { objectId, optionalText, pktDate, rupees } from '../../utils/zodHelpers.js';

// Tracking numbers are typed by hand from the courier's receipt: spaces removed, capitals
const trackingNumber = z
  .string('Tracking number is required')
  .transform((value) => value.replace(/\s+/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9-]{4,40}$/, 'Tracking number should be 4-40 letters, numbers or dashes'));

// First dispatch: courier and tracking number are required.
// Courier re-attempt after a failed delivery: both optional (the old ones are kept).
export const shipOrderSchema = z.strictObject({
  courier: z.enum(COURIERS, `Courier must be one of: ${COURIERS.join(', ')}`).optional(),
  trackingNumber: trackingNumber.optional(),
  courierFee: rupees('Courier fee').optional(),
  codCharge: rupees('COD charge').optional(),
  note: optionalText('Note', 500).optional(),
});

export const deliverOrderSchema = z
  .strictObject({
    // Leave out when the courier collected the full order total
    amountCollected: rupees('Amount collected').optional(),
    note: optionalText('Note', 500).optional(),
  })
  .default({});

export const failDeliverySchema = z
  .strictObject({
    reason: z.enum(DELIVERY_FAILURE_REASONS, `Reason must be one of: ${DELIVERY_FAILURE_REASONS.join(', ')}`),
    note: optionalText('Note', 500).optional(),
  })
  .refine((d) => d.reason !== 'other' || (d.note?.length ?? 0) >= 3, { message: 'Describe what went wrong', path: ['note'] });

export const returnOrderSchema = z.strictObject({
  items: z
    .array(
      z
        .strictObject({
          variantId: objectId('Product size'),
          decision: z.enum(RETURN_DECISIONS, 'Decision must be restock or write_off'),
          reason: optionalText('Reason', 500).optional(),
        })
        .refine((i) => i.decision !== 'write_off' || (i.reason?.length ?? 0) >= 3, {
          message: 'Write why the item is written off',
          path: ['reason'],
        })
    )
    .min(1, 'Record a decision for each returned item'),
  note: optionalText('Note', 500).optional(),
});

// The courier paid the store the COD money for these delivered orders
export const remitSchema = z.strictObject({
  orders: z.array(z.string().trim().min(1).max(40)).min(1, 'Choose at least one order').max(200),
  reference: z.string('Payment reference is required').trim().min(2, 'Enter the payment reference').max(100),
  remittedOn: pktDate('Payment date').optional(),
});

export type ShipOrderInput = z.infer<typeof shipOrderSchema>;
export type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;
export type FailDeliveryInput = z.infer<typeof failDeliverySchema>;
export type ReturnOrderInput = z.infer<typeof returnOrderSchema>;
export type RemitInput = z.infer<typeof remitSchema>;