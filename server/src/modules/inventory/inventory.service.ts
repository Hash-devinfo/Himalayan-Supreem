import mongoose, { isValidObjectId, type Types } from "mongoose";
import Batch, { type BatchDocument } from "../../models/Batch.js";
import StockMovement from "../../models/StockMovement.js";
import Variant from "../../models/Variant.js";
import "../../models/Admin.js"; // registers the Admin model so stock history can show who made each change
import { DEFAULT_LOW_STOCK_THRESHOLD } from "../../constants/inventory.js";
import AppError from "../../utils/AppError.js";
import {
  addDays,
  daysUntil,
  formatPktDate,
  startOfTodayPkt,
} from "../../utils/dates.js";
import { diffChanges } from "../../utils/diffChanges.js";
import { recordAudit, type ActorContext } from "../audit/audit.service.js";
import { findVariantOrThrow } from "../products/variant.service.js";
import type { PaginatedResult } from "../products/product.service.js";
import { recalculateVariantStock, type StockLevel } from "./stock.service.js";
import type {
  AdjustStockInput,
  ListBatchesQuery,
  MovementsQuery,
  ReceiveBatchInput,
  UpdateBatchInput,
} from "./inventory.validation.js";
import { isPastSellCutoff, stopSellingDate } from "./expiry.js";

// ── Shapes returned to the admin panel ────────────────

export interface BatchView {
  id: string;
  batchNumber: string;
  quantityReceived: number;
  quantityRemaining: number;
  receivedDate: string; // YYYY-MM-DD (Pakistan)
  expiryDate: string; // YYYY-MM-DD (Pakistan)
  daysToExpiry: number;
  stopsSellingOn: string;
  isExpired: boolean;
  isSellable: boolean;
  status: string;
  origin?: string;
  unitCost?: number;
  notes?: string;
}

function toBatchView(batch: BatchDocument, now: Date = new Date()): BatchView {
  const isExpired = batch.expiryDate <= now;
  return {
    id: batch.id,
    batchNumber: batch.batchNumber,
    quantityReceived: batch.quantityReceived,
    quantityRemaining: batch.quantityRemaining,
    receivedDate: formatPktDate(batch.receivedDate),
    expiryDate: formatPktDate(batch.expiryDate),
    daysToExpiry: daysUntil(batch.expiryDate, now),
    stopsSellingOn: formatPktDate(stopSellingDate(batch.expiryDate)),
    isExpired,
    isSellable:
      batch.status === "active" &&
      batch.quantityRemaining > 0 &&
      !isPastSellCutoff(batch.expiryDate, now),
    status: batch.status,
    origin: batch.origin,
    unitCost: batch.unitCost,
    notes: batch.notes,
  };
}

// ── Helpers ───────────────────────────────────────────

async function findBatchOrThrow(
  variantId: Types.ObjectId,
  batchId: string,
): Promise<BatchDocument> {
  if (!isValidObjectId(batchId)) {
    throw new AppError("Batch not found", 404);
  }
  const batch = await Batch.findOne({ _id: batchId, variant: variantId });
  if (!batch) {
    throw new AppError("Batch not found", 404);
  }
  return batch;
}

async function assertBatchNumberAvailable(
  variantId: Types.ObjectId,
  batchNumber: string,
  excludeId?: string,
): Promise<void> {
  const existing = await Batch.findOne({ variant: variantId, batchNumber });
  if (existing && existing.id !== excludeId) {
    throw new AppError(
      `Batch "${batchNumber}" already exists for this size`,
      409,
    );
  }
}

// ── Batches ───────────────────────────────────────────

export async function listBatches(
  productId: string,
  variantId: string,
  query: ListBatchesQuery,
): Promise<{
  batches: BatchView[];
  stock: { available: number; reserved: number };
}> {
  const variant = await findVariantOrThrow(productId, variantId);

  const filter: Record<string, unknown> = { variant: variant._id };
  if (query.status) filter.status = query.status;

  const batches = await Batch.find(filter).sort({ expiryDate: 1 });
  const now = new Date();

  return {
    batches: batches.map((batch) => toBatchView(batch, now)),
    stock: { available: variant.availableQty, reserved: variant.reservedQty },
  };
}

export async function receiveBatch(
  productId: string,
  variantId: string,
  input: ReceiveBatchInput,
  actor: ActorContext,
): Promise<{ batch: BatchView; stock: StockLevel }> {
  const variant = await findVariantOrThrow(productId, variantId);

  if (variant.status === "archived") {
    throw new AppError("Cannot receive stock for an archived size", 400);
  }

  await assertBatchNumberAvailable(variant._id, input.batchNumber);

  const result = await mongoose.connection.transaction(async (session) => {
    const [batch] = await Batch.create(
      [
        {
          variant: variant._id,
          product: variant.product,
          batchNumber: input.batchNumber,
          quantityReceived: input.quantity,
          quantityRemaining: input.quantity,
          receivedDate: input.receivedDate,
          expiryDate: input.expiryDate,
          origin: input.origin,
          unitCost: input.unitCost,
          notes: input.notes,
        },
      ],
      { session },
    );
    if (!batch) throw new Error("Batch was not created");

    await StockMovement.create(
      [
        {
          type: "received",
          variant: variant._id,
          product: variant.product,
          batch: batch._id,
          quantity: input.quantity,
          admin: actor.adminId,
        },
      ],
      { session },
    );

    const stock = await recalculateVariantStock(variant._id, session);

    await recordAudit(
      {
        admin: actor.adminId,
        action: "batch.receive",
        entityType: "Batch",
        entityId: batch.id,
        after: {
          sku: variant.sku,
          batchNumber: batch.batchNumber,
          quantity: input.quantity,
          expiryDate: formatPktDate(batch.expiryDate),
        },
        ip: actor.ip,
      },
      session,
    );

    return { batch: toBatchView(batch), stock };
  });

  return result;
}

export async function updateBatch(
  productId: string,
  variantId: string,
  batchId: string,
  input: UpdateBatchInput,
  actor: ActorContext,
): Promise<BatchView> {
  const variant = await findVariantOrThrow(productId, variantId);
  const batch = await findBatchOrThrow(variant._id, batchId);

  const { before, after, hasChanges } = diffChanges(batch.toObject(), input);
  if (!hasChanges) {
    return toBatchView(batch);
  }

  if (after.batchNumber !== undefined) {
    await assertBatchNumberAvailable(
      variant._id,
      input.batchNumber as string,
      batch.id,
    );
  }

  // Show dates as calendar days in the audit record
  for (const record of [before, after]) {
    if (record.expiryDate instanceof Date)
      record.expiryDate = formatPktDate(record.expiryDate);
  }

  await mongoose.connection.transaction(async (session) => {
    batch.set(input);
    await batch.save({ session });

    if (input.expiryDate !== undefined) {
      await recalculateVariantStock(variant._id, session);
    }

    await recordAudit(
      {
        admin: actor.adminId,
        action: "batch.update",
        entityType: "Batch",
        entityId: batch.id,
        before,
        after,
        ip: actor.ip,
      },
      session,
    );
  });

  return toBatchView(batch);
}

// ── Stock adjustments ─────────────────────────────────

export async function adjustStock(
  productId: string,
  variantId: string,
  batchId: string,
  input: AdjustStockInput,
  actor: ActorContext,
): Promise<{ batch: BatchView; stock: StockLevel }> {
  const variant = await findVariantOrThrow(productId, variantId);
  const existing = await findBatchOrThrow(variant._id, batchId);

  if (existing.status === "written_off") {
    throw new AppError(
      "This batch has been written off and can no longer be adjusted",
      400,
    );
  }

  const now = new Date();
  if (input.type === "expired" && !isPastSellCutoff(existing.expiryDate)) {
    throw new AppError(
      `This batch is still on sale (it stops selling on ${formatPktDate(stopSellingDate(existing.expiryDate))}). Use "damaged" or "adjusted_out" to remove stock before then.`,
      400,
    );
  }
  const isIncrease = input.type === "adjusted_in";

  return mongoose.connection.transaction(async (session) => {
    // Change the quantity in one step, and only if enough is left.
    // This stops two people removing the same units at the same moment.
    const condition: Record<string, unknown> = { _id: existing._id };
    if (!isIncrease) {
      condition.quantityRemaining = mongoose.trusted({ $gte: input.quantity });
    }

    const batch = await Batch.findOneAndUpdate(
      condition,
      {
        $inc: {
          quantityRemaining: isIncrease ? input.quantity : -input.quantity,
        },
      },
      { session, new: true },
    );

    if (!batch) {
      throw new AppError(
        `Only ${existing.quantityRemaining} left in batch ${existing.batchNumber}`,
        400,
      );
    }

    // Keep the batch status in step with what's left
    if (batch.quantityRemaining === 0) {
      batch.status =
        input.type === "damaged" || input.type === "expired"
          ? "written_off"
          : "depleted";
    } else if (batch.status === "depleted") {
      batch.status = "active";
    }
    await batch.save({ session });

    await StockMovement.create(
      [
        {
          type: input.type,
          variant: variant._id,
          product: variant.product,
          batch: batch._id,
          quantity: input.quantity,
          reason: input.reason,
          admin: actor.adminId,
        },
      ],
      { session },
    );

    const stock = await recalculateVariantStock(variant._id, session);

    await recordAudit(
      {
        admin: actor.adminId,
        action: "stock.adjust",
        entityType: "Batch",
        entityId: batch.id,
        before: { quantityRemaining: existing.quantityRemaining },
        after: {
          quantityRemaining: batch.quantityRemaining,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason,
        },
        ip: actor.ip,
      },
      session,
    );

    return { batch: toBatchView(batch), stock };
  });
}

// ── Stock history ─────────────────────────────────────

export async function listMovements(
  query: MovementsQuery,
): Promise<PaginatedResult<unknown>> {
  const { variant, batch, type, page, limit } = query;

  const filter: Record<string, unknown> = {};
  if (variant) filter.variant = variant;
  if (batch) filter.batch = batch;
  if (type) filter.type = type;

  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .populate("variant", "sku label")
      .populate("product", "name")
      .populate("batch", "batchNumber")
      .populate("admin", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

// ── Alerts ────────────────────────────────────────────

export interface ExpiryAlert {
  batchId: string;
  batchNumber: string;
  product: string;
  sku: string;
  label: string;
  quantityRemaining: number;
  expiryDate: string;
  stopsSellingOn: string;
  daysToExpiry: number;
}

// expiringSoon: still on sale, but expiring within the warning window (sell or discount these).
// stoppedSelling: past the stop-selling date (or expired) but still on the shelf (write these off).
export async function getExpiryAlerts(
  days: number
): Promise<{ expiringSoon: ExpiryAlert[]; stoppedSelling: ExpiryAlert[] }> {
  const now = new Date();
  const until = addDays(startOfTodayPkt(now), days + 1);

  const filter: Record<string, unknown> = {
    status: 'active',
    quantityRemaining: mongoose.trusted({ $gt: 0 }),
    expiryDate: mongoose.trusted({ $lt: until }),
  };

  const batches = await Batch.find(filter)
    .populate<{ variant: { sku: string; label: string } }>('variant', 'sku label')
    .populate<{ product: { name: string } }>('product', 'name')
    .sort({ expiryDate: 1 });

  const alerts = batches.map((batch) => ({
    alert: {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      product: batch.product?.name ?? '(deleted product)',
      sku: batch.variant?.sku ?? '',
      label: batch.variant?.label ?? '',
      quantityRemaining: batch.quantityRemaining,
      expiryDate: formatPktDate(batch.expiryDate),
      stopsSellingOn: formatPktDate(stopSellingDate(batch.expiryDate)),
      daysToExpiry: daysUntil(batch.expiryDate, now),
    },
    stopped: isPastSellCutoff(batch.expiryDate, now),
  }));

  return {
    expiringSoon: alerts.filter((a) => !a.stopped).map((a) => a.alert),
    stoppedSelling: alerts.filter((a) => a.stopped).map((a) => a.alert),
  };
}

export interface LowStockAlert {
  variantId: string;
  productId: string;
  product: string;
  sku: string;
  label: string;
  availableQty: number;
  reservedQty: number;
  threshold: number;
}

export async function getLowStockAlerts(): Promise<LowStockAlert[]> {
  const filter: Record<string, unknown> = {
    status: "active",
    $expr: mongoose.trusted({
      $lte: [
        "$availableQty",
        { $ifNull: ["$lowStockThreshold", DEFAULT_LOW_STOCK_THRESHOLD] },
      ],
    }),
  };

  const variants = await Variant.find(filter)
    .populate<{
      product: { _id: Types.ObjectId; name: string; status: string };
    }>("product", "name status")
    .sort({ availableQty: 1 });

  return variants
    .filter(
      (variant) => variant.product && variant.product.status !== "archived",
    )
    .map((variant) => ({
      variantId: variant.id,
      productId: variant.product._id.toString(),
      product: variant.product.name,
      sku: variant.sku,
      label: variant.label,
      availableQty: variant.availableQty,
      reservedQty: variant.reservedQty,
      threshold: variant.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
    }));
}
