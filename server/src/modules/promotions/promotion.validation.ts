import { z } from 'zod';
import { DISCOUNT_TYPES, PROMOTION_STATUSES, PROMOTION_TYPES } from '../../constants/enums.js';
import { objectId, paginationQuery, pktDate, rupees } from '../../utils/zodHelpers.js';

// Promotion types that work now. "welcome" and members-only offers need customer accounts (Release 2).
export const AVAILABLE_TYPES = ['code', 'product', 'category', 'seasonal'] as const;

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{2,29}$/, 'Code must be 3-30 letters, numbers or dashes, e.g. EID10');

const ids = (label: string) => z.array(objectId(label)).max(200).default([]);

const fields = {
  name: z.string('Name is required').trim().min(2, 'Name is required').max(80),
  type: z.enum(PROMOTION_TYPES, `Type must be one of: ${AVAILABLE_TYPES.join(', ')}`),
  code: code.optional(),
  audience: z.enum(['all', 'members']).default('all'),
  discountType: z.enum(DISCOUNT_TYPES, 'Discount type must be percent or fixed'),
  value: z.number('Value is required').int('Value must be a whole number').min(1, 'Value must be at least 1'),
  maxDiscount: rupees('Maximum discount').min(1).optional(),
  products: ids('Product'),
  categories: ids('Category'),
  minOrderTotal: rupees('Minimum order').optional(),
  startsOn: pktDate('Start date').optional(),
  endsOn: pktDate('End date').optional(), // the last day (inclusive)
  usageLimit: z.number().int().min(1, 'Usage limit must be at least 1').optional(),
  perCustomerLimit: z.number().int().min(1, 'Per-customer limit must be at least 1').optional(),
  status: z.enum(['active', 'paused']).default('active'),
};

type Fields = {
  type: (typeof PROMOTION_TYPES)[number];
  code?: string;
  audience: 'all' | 'members';
  discountType: 'percent' | 'fixed';
  value: number;
  maxDiscount?: number;
  products: string[];
  categories: string[];
  minOrderTotal?: number;
  startsOn?: Date;
  endsOn?: Date;
  usageLimit?: number;
  perCustomerLimit?: number;
};

// The rules for each type (requirements 4.4), checked together so every problem is listed at once
function checkRules(d: Fields, ctx: z.RefinementCtx) {
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  const isCode = d.type === 'code';

  if (d.type === 'welcome') issue('type', 'Welcome discounts come with customer accounts (Release 2)');
  if (d.audience === 'members') issue('audience', 'Members-only offers come with customer accounts (Release 2)');

  if (isCode && !d.code) issue('code', 'Enter the code customers will type');
  if (!isCode && d.code) issue('code', 'Only discount codes have a code. Other promotions apply automatically.');

  if (d.discountType === 'percent' && d.value > 100) issue('value', 'A percentage cannot be more than 100');
  if (d.maxDiscount !== undefined && !(isCode && d.discountType === 'percent')) issue('maxDiscount', 'A maximum discount is only for percentage codes');

  if (d.type === 'product' && d.products.length === 0) issue('products', 'Choose at least one product');
  if (d.type === 'product' && d.categories.length > 0) issue('categories', 'A product promotion uses products only');
  if (d.type === 'category' && d.categories.length === 0) issue('categories', 'Choose at least one category');
  if (d.type === 'category' && d.products.length > 0) issue('products', 'A category promotion uses categories only');
  if (d.type === 'seasonal' && !d.endsOn) issue('endsOn', 'A seasonal promotion needs an end date');

  // Order-level conditions only make sense for codes (automatic discounts are per item)
  if (!isCode) {
    if (d.minOrderTotal !== undefined) issue('minOrderTotal', 'A minimum order is only for discount codes');
    if (d.usageLimit !== undefined) issue('usageLimit', 'Usage limits are only for discount codes');
    if (d.perCustomerLimit !== undefined) issue('perCustomerLimit', 'Per-customer limits are only for discount codes');
  }
  if (d.usageLimit !== undefined && d.perCustomerLimit !== undefined && d.perCustomerLimit > d.usageLimit) {
    issue('perCustomerLimit', 'The per-customer limit cannot be more than the total usage limit');
  }
  if (d.startsOn && d.endsOn && d.endsOn < d.startsOn) issue('endsOn', 'The end date must be on or after the start date');
}

export const createPromotionSchema = z.strictObject(fields).superRefine(checkRules);

// Editing: type is fixed once created. Everything else can change (orders keep what they got).
export const updatePromotionSchema = z
  .strictObject({
    name: fields.name.optional(),
    code: code.optional(),
    discountType: fields.discountType.optional(),
    value: fields.value.optional(),
    maxDiscount: fields.maxDiscount.nullable(),
    products: z.array(objectId('Product')).max(200).optional(),
    categories: z.array(objectId('Category')).max(200).optional(),
    minOrderTotal: rupees('Minimum order').nullable().optional(),
    startsOn: fields.startsOn,
    endsOn: pktDate('End date').nullable().optional(),
    usageLimit: z.number().int().min(1).nullable().optional(),
    perCustomerLimit: z.number().int().min(1).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

export const listPromotionsQuerySchema = z.strictObject({
  status: z.enum(PROMOTION_STATUSES).optional(),
  type: z.enum(PROMOTION_TYPES).optional(),
  search: z.string().trim().max(60).optional(), // name or code
  ...paginationQuery,
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type ListPromotionsQuery = z.infer<typeof listPromotionsQuerySchema>;
export { checkRules };