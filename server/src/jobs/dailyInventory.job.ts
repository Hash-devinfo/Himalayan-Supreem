import mongoose from "mongoose";
import Batch from "../models/Batch.js";
import StockMovement from "../models/StockMovement.js";
import Variant from "../models/Variant.js";
import { inventoryRules } from "../modules/settings/inventoryRules.js";
import { formatPktDate } from "../utils/dates.js";
import { recordAudit } from "../modules/audit/audit.service.js";
import { recalculateVariantStock } from "../modules/inventory/stock.service.js";
import {
  getExpiryAlerts,
  getLowStockAlerts,
} from "../modules/inventory/inventory.service.js";
import { flagShortfallOrders } from "./shortfall.job.js";
import { markAbandonedCarts } from "./dailyCarts.job.js";
export interface DailyInventorySummary {
  ranAt: string;
  expiredBatchesWrittenOff: number;
  unitsWrittenOff: number;
  sizesRecalculated: number;
  sizesWithShortfall: number;
  ordersFlaggedShortfall: number;
  ordersUnflaggedShortfall: number;
  cartsMarkedAbandoned: number;
  expiringSoon: number;
  stoppedSelling: number;
  lowStock: number;
  durationMs: number;
}

// 1. Batches whose expiry date has passed are written off automatically,
//    with an "expired" stock movement and an audit record.
//    (Batches in their final week stop selling but stay on record until they expire,
//    so you can still see and remove them yourself.)
async function writeOffExpiredBatches(
  now: Date,
): Promise<{ batches: number; units: number }> {
  const filter: Record<string, unknown> = {
    status: "active",
    quantityRemaining: mongoose.trusted({ $gt: 0 }),
    expiryDate: mongoose.trusted({ $lte: now }),
  };
  const expired = await Batch.find(filter).select(
    "_id variant product batchNumber quantityRemaining expiryDate",
  );

  let batches = 0;
  let units = 0;

  for (const batch of expired) {
    const quantity = batch.quantityRemaining;

    const done = await mongoose.connection.transaction(async (session) => {
      // Only if nobody changed the batch since we read it
      const updated = await Batch.findOneAndUpdate(
        { _id: batch._id, status: "active", quantityRemaining: quantity },
        { $set: { quantityRemaining: 0, status: "written_off" } },
        { session, new: true },
      );
      if (!updated) return false;

      const reason = `Automatic write-off: expired on ${formatPktDate(batch.expiryDate)}`;

      await StockMovement.create(
        [
          {
            type: "expired",
            variant: batch.variant,
            product: batch.product,
            batch: batch._id,
            quantity,
            reason,
          },
        ],
        { session },
      );

      await recalculateVariantStock(batch.variant, session);

      await recordAudit(
        {
          action: "stock.auto_expire",
          entityType: "Batch",
          entityId: batch._id,
          before: { quantityRemaining: quantity, status: "active" },
          after: { quantityRemaining: 0, status: "written_off", reason },
        },
        session,
      );

      return true;
    });

    // Count only after the transaction has committed (it may be retried internally)
    if (done) {
      batches += 1;
      units += quantity;
    }
  }

  return { batches, units };
}

async function recalculateAllStock(): Promise<{
  sizes: number;
  shortfalls: number;
  shortVariants: Map<string, number>;
}> {
  const filter: Record<string, unknown> = {
    status: mongoose.trusted({ $ne: "archived" }),
  };
  const cursor = Variant.find(filter).select("_id").cursor();

  let sizes = 0;
  let shortfalls = 0;
  const shortVariants = new Map<string, number>(); // size -> how many units can still be sold

  for await (const variant of cursor) {
    const level = await recalculateVariantStock(variant._id);
    sizes += 1;
    if (level.shortfall) {
      shortfalls += 1;
      shortVariants.set(String(variant._id), level.sellable);
    }
  }

  return { sizes, shortfalls, shortVariants };
}

export async function runDailyInventoryCheck(
  now: Date = new Date(),
): Promise<DailyInventorySummary> {
  const startedAt = Date.now();

  const writtenOff = await writeOffExpiredBatches(now);
  const stock = await recalculateAllStock();

  // Flag the open orders that are no longer covered by sellable stock (and clear the ones that are)
  const shortfall = await flagShortfallOrders(stock.shortVariants);

  // Carts left with items: marked "abandoned" for the analytics report
  const cartsMarkedAbandoned = await markAbandonedCarts(now);
  // 3. Counts for the alerts, so the morning log shows what needs attention
  const [expiry, lowStock] = await Promise.all([
    getExpiryAlerts(inventoryRules().expiryWarningDays),
    getLowStockAlerts(),
  ]);

  const summary: DailyInventorySummary = {
    ranAt: now.toISOString(),
    expiredBatchesWrittenOff: writtenOff.batches,
    unitsWrittenOff: writtenOff.units,
    sizesRecalculated: stock.sizes,
    sizesWithShortfall: stock.shortfalls,
    ordersFlaggedShortfall: shortfall.flagged,
    ordersUnflaggedShortfall: shortfall.cleared,
    cartsMarkedAbandoned,
    expiringSoon: expiry.expiringSoon.length,
    stoppedSelling: expiry.stoppedSelling.length,
    lowStock: lowStock.length,
    durationMs: Date.now() - startedAt,
  };

  await recordAudit({
    action: "job.daily_inventory",
    entityType: "Job",
    after: { ...summary },
  });

  return summary;
}
