import { z } from 'zod';
import { REFUND_REASONS, REFUND_STATUSES } from '../../constants/enums.js';
import { objectId, optionalText, paginationQuery, pktDate, rupees } from '../../utils/zodHelpers.js';

// Payout details are stored as text. 13+ digits in a row looks like a card or bank account
// number, which this system must never store (project security rule).
const noAccountNumbers = (label: string, max: number) =>
  optionalText(label, max).refine((text) => !/\d{13,}/.test(text.replace(/[\s-]/g, '')), {
    message: `${label} must not contain card or account numbers. Enter only the transaction ID.`,
  });

export const createRefundSchema = z.strictObject({
  order: z.string('Order is required').trim().min(1, 'Order is required').max(40),
  reason: z.enum(REFUND_REASONS, 'Refunds are only for damaged or incorrect products'),
  description: z.string('Describe what the customer reported').trim().min(5, 'Describe what the customer reported').max(1000),
  items: z
    .array(
      z.strictObject({
        variantId: objectId('Product size'),
        qty: z.number('Quantity must be a number').int().min(1, 'Quantity must be at least 1'),
        // Leave out to refund what the customer paid for these units
        amount: rupees('Refund amount').optional(),
      })
    )
    .min(1, 'Choose at least one item to refund')
    .max(30),
});

export const rejectRefundSchema = z.strictObject({
  reason: z.string('Write why the refund is rejected').trim().min(3, 'Write why the refund is rejected').max(500),
});

export const payRefundSchema = z.strictObject({
  payoutMethod: noAccountNumbers('Payout method', 100).pipe(z.string().min(2, 'Enter how the refund was paid')),
  payoutReference: noAccountNumbers('Payout reference', 100).optional(),
  paidOn: pktDate('Payment date').optional(),
  // The damaged or incorrect units will not be sold again: record them as written off
  writeOff: z.boolean('Write-off must be true or false').default(false),
});

export const listRefundsQuerySchema = z.strictObject({
  status: z.enum(REFUND_STATUSES, `Status must be one of: ${REFUND_STATUSES.join(', ')}`).optional(),
  order: z.string().trim().max(40).optional(),
  ...paginationQuery,
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type RejectRefundInput = z.infer<typeof rejectRefundSchema>;
export type PayRefundInput = z.infer<typeof payRefundSchema>;
export type ListRefundsQuery = z.infer<typeof listRefundsQuerySchema>;