import { z } from 'zod';
import { INTEGRATION_ACTIONS } from '../../../models/IntegrationLog.js';
import { paginationQuery } from '../../../utils/zodHelpers.js';

const addressCode = z.string().trim().min(1).max(40);

export const postexSettingsSchema = z
  .strictObject({
    pickupAddressCode: addressCode.optional(),
    returnAddressCode: addressCode.nullable().optional(), // null = use PostEx's default return address
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

// Match one of our cities to PostEx's spelling by hand; null = undo the hand match
export const matchCitySchema = z.strictObject({
  postexCityName: z.string().trim().min(1).max(80).nullable(),
});

export const integrationLogQuerySchema = z.strictObject({
  action: z.enum(INTEGRATION_ACTIONS).optional(),
  status: z.enum(['success', 'failed']).optional(),
  order: z.string().trim().max(30).optional(), // order number
  ...paginationQuery,
});

export type PostexSettingsInput = z.infer<typeof postexSettingsSchema>;
export type MatchCityInput = z.infer<typeof matchCitySchema>;
export type IntegrationLogQuery = z.infer<typeof integrationLogQuerySchema>;