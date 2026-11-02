import { z } from 'zod';
import { CITY_SOURCES, PROVINCES } from '../../constants/enums.js';
import { objectId, paginationQuery, rupees } from '../../utils/zodHelpers.js';

// ── Zones ─────────────────────────────────────────────

const zoneName = z.string().trim().min(2, 'Zone name must be at least 2 characters').max(60, 'Zone name cannot be longer than 60 characters');
const estimateText = z.string().trim().min(2, 'Delivery estimate is required, e.g. "2–4 working days"').max(60, 'Estimate cannot be longer than 60 characters');
const sortOrder = z.number('Sort order must be a number').int('Sort order must be a whole number').min(0).max(9999);

const weightRules = z
  .array(
    z.strictObject({
      upToGrams: z.number('Weight must be a number').int('Weight must be in whole grams').min(1, 'Weight must be at least 1 gram').max(100_000),
      charge: rupees('Charge'),
    })
  )
  .max(20, 'At most 20 weight rules per zone')
  .refine(
    (rules) => rules.every((rule, i) => i === 0 || rule.upToGrams > (rules[i - 1]?.upToGrams ?? 0)),
    'Weight rules must be in increasing order of weight, with no repeats'
  );

export const createZoneSchema = z.strictObject({
  name: zoneName,
  charge: rupees('Delivery charge'),
  estimateText,
  weightRules: weightRules.optional(),
  sortOrder: sortOrder.optional(),
});

export const updateZoneSchema = z
  .strictObject({
    name: zoneName.optional(),
    charge: rupees('Delivery charge').optional(),
    estimateText: estimateText.optional(),
    weightRules: weightRules.optional(),
    sortOrder: sortOrder.optional(),
    active: z.boolean('Active must be true or false').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

// ── Cities ────────────────────────────────────────────

const cityName = z.string().trim().min(2, 'City name must be at least 2 characters').max(60, 'City name cannot be longer than 60 characters');
const province = z.enum(PROVINCES, `Province must be one of: ${PROVINCES.join(', ')}`);
// A zone ID, or null = "use the default zone"
const zoneRef = objectId('Zone').nullable();

export const createCitySchema = z.strictObject({
  name: cityName,
  province,
  zone: zoneRef.optional(),
  sortOrder: sortOrder.optional(),
});

export const updateCitySchema = z
  .strictObject({
    zone: zoneRef.optional(),
    isBlocked: z.boolean('isBlocked must be true or false').optional(),
    sortOrder: sortOrder.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const assignZoneSchema = z.strictObject({
  cityIds: z.array(objectId('City')).min(1, 'Choose at least one city').max(200, 'At most 200 cities at once'),
  zone: zoneRef,
});

const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export const listCitiesQuerySchema = z.object({
  search: z.string().trim().max(60).optional(),
  province: province.optional(),
  // a zone ID, or "default" for cities without a zone
  zone: z.union([z.literal('default'), objectId('Zone')]).optional(),
  blocked: booleanQuery.optional(),
  source: z.enum(CITY_SOURCES).optional(),
  ...paginationQuery,
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
export type CreateCityInput = z.infer<typeof createCitySchema>;
export type UpdateCityInput = z.infer<typeof updateCitySchema>;
export type AssignZoneInput = z.infer<typeof assignZoneSchema>;
export type ListCitiesQuery = z.infer<typeof listCitiesQuerySchema>;