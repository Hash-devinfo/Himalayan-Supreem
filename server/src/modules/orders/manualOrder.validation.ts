import { z } from 'zod';
import { addressSchema } from '../checkout/checkout.validation.js';
import { pkMobile } from '../settings/settings.validation.js';
import { objectId, optionalText, rupees } from '../../utils/zodHelpers.js';
import { MAX_CART_LINES, MAX_QTY_PER_ITEM } from '../../constants/cart.js';

// An order the admin enters for a customer who ordered by WhatsApp or phone (requirements 4.3).
// Same stock, delivery and risk rules as a website order.
export const manualOrderSchema = z
  .strictObject({
    channel: z.enum(['whatsapp', 'phone', 'other'], 'Channel must be whatsapp, phone or other'),
    name: z.string('Name is required').trim().min(2, 'Enter the customer name').max(80),
    phone: pkMobile('Phone number'),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')).optional(),
    address: addressSchema,
    items: z
      .array(
        z.strictObject({
          variantId: objectId('Product size'),
          qty: z.number('Quantity must be a number').int('Quantity must be a whole number').min(1, 'Quantity must be at least 1').max(MAX_QTY_PER_ITEM, `At most ${MAX_QTY_PER_ITEM} of one size`),
        }),
         'Add at least one item'
      )
      .min(1, 'Add at least one item')
      .max(MAX_CART_LINES)
      .refine((items) => new Set(items.map((i) => i.variantId)).size === items.length, 'Each product size can be listed only once'),
    // true = the customer already confirmed with you while ordering: the order starts as Confirmed
    confirmedWithCustomer: z.boolean('Confirmed must be true or false').default(false),
    // Optional manual discount on the whole order; the reason is kept in the audit log
    discount: z
      .strictObject({
        amount: rupees('Discount').min(1, 'Discount must be at least Rs 1'),
        reason: z.string('Write why the discount is given').trim().min(3, 'Write why the discount is given').max(300),
      })
      .optional(),
    note: optionalText('Note', 1000).optional(),
  });

export type ManualOrderInput = z.infer<typeof manualOrderSchema>;