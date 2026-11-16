import { z } from 'zod';
import { REVIEW_STATUSES } from '../../constants/enums.js';
import { objectId, optionalText, paginationQuery } from '../../utils/zodHelpers.js';

export const listReviewsQuerySchema = z.strictObject({
  status: z.enum(REVIEW_STATUSES, `Status must be one of: ${REVIEW_STATUSES.join(', ')}`).default('pending'),
  product: objectId('Product').optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  // order number or customer name
  search: z.string().trim().max(80).optional(),
  ...paginationQuery,
});

// The admin's decision. Hiding or removing needs a short reason (kept for the audit log, never shown to customers).
export const moderateReviewSchema = z
  .strictObject({
    status: z.enum(['published', 'hidden', 'removed'], 'Status must be published, hidden or removed'),
    note: optionalText('Note', 500).optional(),
  })
  .refine((d) => d.status === 'published' || (d.note?.length ?? 0) >= 3, {
    message: 'Write why the review is hidden or removed',
    path: ['note'],
  });

export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;