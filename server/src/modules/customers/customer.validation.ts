import { z } from 'zod';
import { pkMobile } from '../settings/settings.validation.js';
import { paginationQuery } from '../../utils/zodHelpers.js';

// The phone in the URL: 03001234567, 0300-1234567 or +923001234567 all work
export const phoneParamSchema = pkMobile('Phone number');

export const blockCustomerSchema = z.strictObject({
  reason: z.string('Write why this number is blocked').trim().min(3, 'Write why this number is blocked').max(500),
});

export const unblockCustomerSchema = z.strictObject({
  note: z.string().trim().max(500).optional(),
});

export const listCustomersQuerySchema = z.strictObject({
  search: z.string().trim().max(80).optional(),
  // blocked = blocked numbers; highRisk = at or above the refusal threshold
  filter: z.enum(['blocked', 'highRisk'], 'Filter must be blocked or highRisk').optional(),
  ...paginationQuery,
});

export type BlockCustomerInput = z.infer<typeof blockCustomerSchema>;
export type UnblockCustomerInput = z.infer<typeof unblockCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;