import { z } from 'zod';
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES } from '../../constants/enums.js';
import { paginationQuery } from '../../utils/zodHelpers.js';

export const listNotificationsQuerySchema = z.object({
  order: z.string().trim().min(1).max(40).optional(), // order number or ID
  status: z.enum(NOTIFICATION_STATUSES, 'Unknown status').optional(),
  channel: z.enum(NOTIFICATION_CHANNELS, 'Unknown channel').optional(),
  ...paginationQuery,
});