import { z } from 'zod';
import { addressSchema } from '../checkout/checkout.validation.js';
import { pkMobile } from '../settings/settings.validation.js';
import { optionalText } from '../../utils/zodHelpers.js';

// Before packing, the admin may correct the delivery address and contact details (requirements 4.3).
// Items cannot be changed: cancel and place a new order instead.
export const updateContactSchema = z
  .strictObject({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
    phone: pkMobile('Phone number').optional(),
    // null removes the email
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')).nullable().optional(),
    address: addressSchema.optional(),
    // Keep the delivery charge agreed at checkout (default), or switch to the new city's charge
    recalculateDelivery: z.boolean('Recalculate delivery must be true or false').default(false),
    note: optionalText('Note', 500).optional(),
  })
  .refine((d) => d.name !== undefined || d.phone !== undefined || d.email !== undefined || d.address !== undefined, {
    message: 'Provide the name, phone, email or address to change',
  })
  .refine((d) => !d.recalculateDelivery || d.address !== undefined, {
    message: 'Delivery can only be recalculated when the address changes',
    path: ['recalculateDelivery'],
  });

export type UpdateContactInput = z.infer<typeof updateContactSchema>;