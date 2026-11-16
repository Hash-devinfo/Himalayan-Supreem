import { z } from 'zod';
import { objectId, optionalText, paginationQuery } from '../../utils/zodHelpers.js';
import { orderNumberField } from '../orders/orderPublic.validation.js';
import { pkMobile } from '../settings/settings.validation.js';

// Reviews are shown as plain text, never HTML, so a pasted <script> can never run on the site
const plainText = (label: string, max: number) =>
  optionalText(label, max)
    .refine((text) => !/<\s*\/?\s*[a-z][^>]*>/i.test(text), `${label}: please use plain text, not HTML`)
    .optional()
    .transform((value) => (value ? value : undefined));

// The customer proves the order is theirs: order number + phone, OR the code from the review link
const accessShape = {
  orderNumber: orderNumberField,
  phone: pkMobile('Phone number').optional(),
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, 'This review link is not valid').optional(),
};

const oneWayOnly = (data: { phone?: string; code?: string }) => Boolean(data.phone) !== Boolean(data.code);
const oneWayMessage = { message: 'Enter the phone number you used for this order', path: ['phone'] };

export const reviewAccessSchema = z.strictObject(accessShape).refine(oneWayOnly, oneWayMessage);

export const submitReviewsSchema = z
  .strictObject({
    ...accessShape,
    reviews: z
      .array(
        z.strictObject({
          productId: objectId('Product'),
          rating: z.number('Choose a star rating').int('Choose a star rating from 1 to 5').min(1, 'Choose a star rating from 1 to 5').max(5, 'Choose a star rating from 1 to 5'),
          title: plainText('Title', 100),
          body: plainText('Review', 2000),
        })
      , 'Add at least one review')
      .min(1, 'Add at least one review')
      .max(20),
  })
  .refine(oneWayOnly, oneWayMessage);

export const productReviewsQuerySchema = z.object({
  ...paginationQuery,
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ReviewAccessInput = z.infer<typeof reviewAccessSchema>;
export type SubmitReviewsInput = z.infer<typeof submitReviewsSchema>;
export type ProductReviewsQuery = z.infer<typeof productReviewsQuerySchema>;