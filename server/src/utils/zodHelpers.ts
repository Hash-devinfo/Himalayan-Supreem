import { z } from 'zod';

// Shared building blocks for validation schemas.

export const objectId = (label: string) =>
  z.string().trim().regex(/^[a-f0-9]{24}$/i, `${label} is not a valid ID`);

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers and hyphens')
  .max(140, 'Slug is too long');

export const rupees = (label: string) =>
  z
    .number(`${label} must be a number`)
    .int(`${label} must be in whole rupees`)
    .min(0, `${label} cannot be negative`)
    .max(10_000_000, `${label} is too large`);

export const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} cannot be longer than ${max} characters`);

// For list pages: ?page=2&limit=20 (query values arrive as text, so they are converted)
export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};