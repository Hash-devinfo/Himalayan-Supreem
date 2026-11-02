import { z } from "zod";
import { BATCH_STATUSES, STOCK_MOVEMENT_TYPES } from "../../constants/enums.js";
import {
  objectId,
  optionalText,
  paginationQuery,
  pktDate,
  rupees,
} from "../../utils/zodHelpers.js";
import { startOfTodayPkt } from "../../utils/dates.js";
import { STOP_SELLING_DAYS_BEFORE_EXPIRY } from "../../constants/inventory.js";
import { sellableExpiryCutoff } from "./expiry.js";

const batchNumber = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Batch number is required")
  .max(50, "Batch number cannot be longer than 50 characters")
  .regex(
    /^[A-Z0-9][A-Z0-9\-/.]*$/,
    "Batch number can only contain letters, numbers, - / and .",
  );

const quantity = z
  .number("Quantity must be a number")
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(100_000, "Quantity is too large");

// ── Receive a new batch ───────────────────────────────

export const receiveBatchSchema = z
  .strictObject({
    batchNumber,
    quantity,
    receivedDate: pktDate("Received date").optional(),
    expiryDate: pktDate("Expiry date"),
    origin: optionalText("Origin", 200).optional(),
    unitCost: rupees("Unit cost").optional(),
    notes: optionalText("Notes", 1000).optional(),
  })
  .transform((data) => ({
    ...data,
    receivedDate: data.receivedDate ?? startOfTodayPkt(),
  }))
  .refine((data) => data.receivedDate <= startOfTodayPkt(), {
    message: "Received date cannot be in the future",
    path: ["receivedDate"],
  })
  .refine((data) => data.expiryDate > data.receivedDate, {
    message: "Expiry date must be after the received date",
    path: ["expiryDate"],
  })
  .refine((data) => data.expiryDate > sellableExpiryCutoff(), {
    message: `This batch expires within ${STOP_SELLING_DAYS_BEFORE_EXPIRY} days, so it cannot be sold. Stock stops selling ${STOP_SELLING_DAYS_BEFORE_EXPIRY} days before expiry.`,
    path: ["expiryDate"],
  });

// ── Correct batch details (not quantities) ────────────

export const updateBatchSchema = z
  .strictObject({
    batchNumber: batchNumber.optional(),
    expiryDate: pktDate("Expiry date").optional(),
    origin: optionalText("Origin", 200).optional(),
    unitCost: rupees("Unit cost").optional(),
    notes: optionalText("Notes", 1000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

// ── Adjust stock in a batch ───────────────────────────

export const ADJUSTMENT_TYPES = [
  "adjusted_in",
  "adjusted_out",
  "damaged",
  "expired",
] as const;

export const adjustStockSchema = z.strictObject({
  type: z.enum(
    ADJUSTMENT_TYPES,
    "Type must be adjusted_in, adjusted_out, damaged or expired",
  ),
  quantity,
  reason: z
    .string("A reason is required")
    .trim()
    .min(3, "Please give a reason (at least 3 characters)")
    .max(500, "Reason cannot be longer than 500 characters"),
});

// ── Lists and alerts ──────────────────────────────────

export const listBatchesQuerySchema = z.object({
  status: z.enum(BATCH_STATUSES).optional(),
});

export const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(60),
});

export const movementsQuerySchema = z.object({
  variant: objectId("Variant").optional(),
  batch: objectId("Batch").optional(),
  type: z.enum(STOCK_MOVEMENT_TYPES).optional(),
  ...paginationQuery,
});

export type ReceiveBatchInput = z.infer<typeof receiveBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;
export type ExpiringQuery = z.infer<typeof expiringQuerySchema>;
export type MovementsQuery = z.infer<typeof movementsQuerySchema>;
