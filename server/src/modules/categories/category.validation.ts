import { z } from 'zod';
import { CATEGORY_STATUSES } from '../../constants/enums.js';

const name = z
  .string()
  .trim()
  .min(2, 'Category name must be at least 2 characters')
  .max(60, 'Category name cannot be longer than 60 characters');

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers and hyphens')
  .max(80, 'Slug cannot be longer than 80 characters');

const description = z
  .string()
  .trim()
  .max(500, 'Description cannot be longer than 500 characters');

const sortOrder = z
  .number('Sort order must be a number')
  .int('Sort order must be a whole number')
  .min(0, 'Sort order cannot be negative')
  .max(9999);

const status = z.enum(CATEGORY_STATUSES, 'Status must be active, hidden or archived');

export const createCategorySchema = z.strictObject({
  name,
  slug: slug.optional(),
  description: description.optional(),
  sortOrder: sortOrder.optional(),
  status: status.optional(),
});

export const updateCategorySchema = z
  .strictObject({
    name: name.optional(),
    slug: slug.optional(),
    description: description.optional(),
    sortOrder: sortOrder.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const changeCategoryStatusSchema = z.strictObject({
  status,
});

export const listCategoriesQuerySchema = z.object({
  status: status.optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ChangeCategoryStatusInput = z.infer<typeof changeCategoryStatusSchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;