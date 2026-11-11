import { z } from 'zod';
import { PAYMENT_METHODS, PROVINCES } from '../../constants/enums.js';
import { objectId } from '../../utils/zodHelpers.js';
import { pkMobile } from '../settings/settings.validation.js';

// Optional text: blank boxes ("" or spaces) count as "not given"
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} cannot be longer than ${max} characters`)
    .optional()
    .transform((value) => (value ? value : undefined));

const addressSchema = z
  .strictObject({
    line1: z.string('Address is required').trim().min(5, 'Please enter your full address (house, street)').max(200, 'Address cannot be longer than 200 characters'),
    line2: optionalText('Address line 2', 200),
    area: optionalText('Area', 100),
    // Either a city from the list, or a typed city with its province
    cityId: objectId('City').optional(),
    cityName: z.string().trim().min(2, 'City name must be at least 2 characters').max(60, 'City name cannot be longer than 60 characters').optional(),
    province: z.enum(PROVINCES, `Province must be one of: ${PROVINCES.join(', ')}`).optional(),
  })
  .refine((data) => Boolean(data.cityId) !== Boolean(data.cityName && data.province), {
    message: 'Choose a city from the list, or type your city and choose its province',
    path: ['cityId'],
  });

export const checkoutSchema = z.strictObject({
  name: z.string('Name is required').trim().min(2, 'Please enter your name').max(80, 'Name cannot be longer than 80 characters'),
  phone: pkMobile('Phone number'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(z.email('Enter a valid email address').optional()),
  address: addressSchema,
  paymentMethod: z.enum(PAYMENT_METHODS, 'Choose a payment method').default('cod'),
  // Where the visit came from (sent by the website, for reports)
  source: z
    .strictObject({
      referrer: optionalText('Referrer', 500),
      utmSource: optionalText('utm_source', 100),
      utmMedium: optionalText('utm_medium', 100),
      utmCampaign: optionalText('utm_campaign', 100),
    })
    .optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;