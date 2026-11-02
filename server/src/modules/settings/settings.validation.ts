import { z } from 'zod';
import { optionalText, rupees } from '../../utils/zodHelpers.js';
import { normalizePkMobile } from '../../utils/phone.js';

export const pkMobile = (label: string) =>
  z
    .string(`${label} is required`)
    .trim()
    .transform((value, ctx) => {
      const normalized = normalizePkMobile(value);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: `${label} must be a Pakistani mobile number, e.g. 0300 1234567` });
        return z.NEVER;
      }
      return normalized;
    });

export const updateSettingsSchema = z
  .strictObject({
    store: z
      .strictObject({
        name: z.string().trim().min(2, 'Store name must be at least 2 characters').max(80).optional(),
        email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')).optional(),
        whatsappNumber: pkMobile('WhatsApp number').optional(),
        supportHours: optionalText('Support hours', 120).optional(),
      })
      .optional(),
    orderPrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,6}$/, 'Order prefix must be 2 to 6 letters')
      .optional(),
    // null turns free delivery off
    freeDeliveryThreshold: rupees('Free delivery threshold').nullable().optional(),
    defaultPackagingCost: rupees('Default packaging cost').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one setting to update',
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;