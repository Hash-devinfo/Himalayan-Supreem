import { z } from 'zod';
import { formatPktDate, pktDateToUtc } from './dates.js';
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

// A calendar date typed as "YYYY-MM-DD", converted to the start of that day in Pakistan.
// Rejects impossible dates like 2026-02-30.
export const pktDate = (label: string) =>
  z
    .string(`${label} is required`)
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be in YYYY-MM-DD format`)
    .refine((text) => {
      try {
        return formatPktDate(pktDateToUtc(text)) === text;
      } catch {
        return false;
      }
    }, `${label} is not a real date`)
    .transform((text) => pktDateToUtc(text));