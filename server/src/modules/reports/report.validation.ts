import { z } from 'zod';
import { pktDate } from '../../utils/zodHelpers.js';

const MAX_RANGE_DAYS = 366;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (Pakistan dates, "to" includes that whole day).
// Leave both out for the last 30 days.
export const dateRangeQuery = {
  from: pktDate('From date').optional(),
  to: pktDate('To date').optional(),
  // &format=csv downloads the report as a spreadsheet file instead of JSON
  format: z.enum(['json', 'csv'], 'Format must be json or csv').default('json'),
};

export const checkRange = <T extends { from?: Date; to?: Date }>(schema: z.ZodType<T>) =>
  schema.refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'From date must be on or before To date', path: ['from'] }).refine(
    (q) => !q.from || !q.to || (q.to.getTime() - q.from.getTime()) / 86_400_000 < MAX_RANGE_DAYS,
    { message: `Choose a range of at most ${MAX_RANGE_DAYS} days`, path: ['to'] }
  );

export const SALES_GROUPS = ['day', 'product', 'variant', 'category', 'courier'] as const;

export const salesQuerySchema = checkRange(
  z.strictObject({
    ...dateRangeQuery,
    groupBy: z.enum(SALES_GROUPS, `Group by must be one of: ${SALES_GROUPS.join(', ')}`).default('day'),
  })
);

export type SalesQuery = z.infer<typeof salesQuerySchema>;
export type SalesGroup = (typeof SALES_GROUPS)[number];


export const profitQuerySchema = checkRange(z.strictObject({ ...dateRangeQuery }));

export type ProfitQuery = z.infer<typeof profitQuerySchema>;


// Stock levels are always "now"; the date range is for stock movements
export const inventoryQuerySchema = checkRange(z.strictObject({ ...dateRangeQuery }));

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;

export const fulfillmentQuerySchema = checkRange(z.strictObject({ ...dateRangeQuery }));

export type FulfillmentQuery = z.infer<typeof fulfillmentQuerySchema>;


export const cancellationsQuerySchema = checkRange(z.strictObject({ ...dateRangeQuery }));

export type CancellationsQuery = z.infer<typeof cancellationsQuerySchema>;