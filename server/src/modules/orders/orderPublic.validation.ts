import { z } from 'zod';
import { optionalText } from '../../utils/zodHelpers.js';
import { pkMobile } from '../settings/settings.validation.js';

// The customer proves the order is theirs with the order number AND the phone used at checkout
const orderAndPhone = {
  orderNumber: z
    .string('Order number is required')
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}-\d{6}-\d{4,}$/, 'Enter your order number as shown in your confirmation, e.g. ORD-261112-0001'),
  phone: pkMobile('Phone number'),
};

export const lookupOrderSchema = z.strictObject(orderAndPhone);

export const requestCancellationSchema = z.strictObject({
  ...orderAndPhone,
  reason: optionalText('Reason', 500).optional(),
});

export type LookupOrderInput = z.infer<typeof lookupOrderSchema>;
export type RequestCancellationInput = z.infer<typeof requestCancellationSchema>;