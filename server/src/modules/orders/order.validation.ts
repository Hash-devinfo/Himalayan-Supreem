import { z } from 'zod';
import { CONTACT_OUTCOMES, ORDER_STATUSES } from '../../constants/enums.js';
import { optionalText, paginationQuery, pktDate } from '../../utils/zodHelpers.js';

export const listOrdersQuerySchema = z
  .object({
    status: z.enum(ORDER_STATUSES, 'Unknown order status').optional(),
    // order number, phone number or customer name
    search: z.string().trim().max(80).optional(),
    from: pktDate('From date').optional(),
    to: pktDate('To date').optional(),
    flag: z.enum(['unlistedCity', 'stockShortfall', 'cancellationRequested'], 'Unknown flag').optional(),
    ...paginationQuery,
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'From date must be on or before To date', path: ['from'] });

export const logCallSchema = z
  .strictObject({
    outcome: z.enum(CONTACT_OUTCOMES, `Outcome must be one of: ${CONTACT_OUTCOMES.join(', ')}`),
    note: optionalText('Note', 500).optional(),
  })
  .refine((data) => data.outcome !== 'customer_cancelled' || (data.note?.length ?? 0) >= 3, {
    message: 'Write why the customer cancelled',
    path: ['note'],
  });

export const cancelOrderSchema = z.strictObject({
  reason: z.string('Reason is required').trim().min(3, 'Write the reason for cancelling').max(500),
});

export const updateNotesSchema = z.strictObject({
  adminNotes: optionalText('Notes', 2000),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type LogCallInput = z.infer<typeof logCallSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type UpdateNotesInput = z.infer<typeof updateNotesSchema>;