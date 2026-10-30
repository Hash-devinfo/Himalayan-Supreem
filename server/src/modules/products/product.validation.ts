import { z } from 'zod';
import { PRODUCT_STATUSES } from '../../constants/enums.js';
import { objectId, optionalText, paginationQuery, slugField } from '../../utils/zodHelpers.js';

const productFields = {
  name: z
    .string()
    .trim()
    .min(2, 'Product name must be at least 2 characters')
    .max(120, 'Product name cannot be longer than 120 characters'),
  slug: slugField,
  category: objectId('Category'),
  shortDescription: optionalText('Short description', 200),
  description: optionalText('Description', 5000),
  ingredients: optionalText('Ingredients', 2000),
  allergens: optionalText('Allergens', 2000),
  storageInstructions: optionalText('Storage instructions', 2000),
  usageDirections: optionalText('Usage directions', 2000),
  origin: optionalText('Origin', 200),
  claims: z
    .array(z.string().trim().min(1, 'Claims cannot be empty').max(200, 'Each claim can be up to 200 characters'))
    .max(20, 'A product can have up to 20 claims'),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(40, 'Each tag can be up to 40 characters'))
    .max(20, 'A product can have up to 20 tags'),
  seo: z.strictObject({
    title: optionalText('SEO title', 70).optional(),
    description: optionalText('SEO description', 160).optional(),
  }),
};

const status = z.enum(PRODUCT_STATUSES, 'Status must be draft, published, unpublished or archived');

export const createProductSchema = z.strictObject({
  name: productFields.name,
  category: productFields.category,
  slug: productFields.slug.optional(),
  shortDescription: productFields.shortDescription.optional(),
  description: productFields.description.optional(),
  ingredients: productFields.ingredients.optional(),
  allergens: productFields.allergens.optional(),
  storageInstructions: productFields.storageInstructions.optional(),
  usageDirections: productFields.usageDirections.optional(),
  origin: productFields.origin.optional(),
  claims: productFields.claims.optional(),
  tags: productFields.tags.optional(),
  seo: productFields.seo.optional(),
});

export const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const changeProductStatusSchema = z.strictObject({
  status,
});

export const listProductsAdminQuerySchema = z.object({
  status: status.optional(),
  category: objectId('Category').optional(),
  search: z.string().trim().max(100).optional(),
  ...paginationQuery,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ChangeProductStatusInput = z.infer<typeof changeProductStatusSchema>;
export type ListProductsAdminQuery = z.infer<typeof listProductsAdminQuerySchema>;


// ── Public storefront ─────────────────────────────────

export const PUBLIC_SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'name'] as const;

export const listProductsPublicQuerySchema = z
  .object({
    category: slugField.optional(),
    search: z.string().trim().min(1).max(100).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    size: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^\d+(\.\d+)?-(g|kg|ml|l|pcs)$/, 'Size must look like 250-g or 1-l')
      .optional(),
    inStock: z
      .enum(['true', 'false'], 'inStock must be true or false')
      .transform((value) => value === 'true')
      .optional(),
    sort: z.enum(PUBLIC_SORTS, 'Unknown sort option').optional(),
    ...paginationQuery,
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'Minimum price cannot be more than maximum price',
    path: ['minPrice'],
  });

export type ListProductsPublicQuery = z.infer<typeof listProductsPublicQuerySchema>;