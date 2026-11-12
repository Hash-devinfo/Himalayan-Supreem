import mongoose, { type Types } from 'mongoose';
import Variant from '../../models/Variant.js';
import Batch from '../../models/Batch.js';
import StockMovement from '../../models/StockMovement.js';
import { DEFAULT_LOW_STOCK_THRESHOLD, EXPIRY_WARNING_DAYS } from '../../constants/inventory.js';
import { isPastSellCutoff } from '../inventory/expiry.js';
import { getExpiryAlerts, getLowStockAlerts } from '../inventory/inventory.service.js';
import { resolveRange } from './reportRange.js';
import type { InventoryQuery } from './report.validation.js';

export const INVENTORY_DEFINITIONS = {
  onHand: 'Units physically in active batches right now, including batches that have stopped selling.',
  sellable: 'Units in batches that can still be sold (not within the stop-selling days before expiry).',
  reserved: 'Units held for orders that are not packed yet.',
  available: 'Sellable - reserved: what customers can still buy.',
  stockValue: 'On-hand units x batch cost (or the size cost price). Units with no cost entered are not counted.',
  expiringSoon: `Batches still on sale that expire within ${EXPIRY_WARNING_DAYS} days.`,
  stoppedSelling: 'Batches past their stop-selling date but still holding stock: write these off.',
  movements: 'Every stock change in the period, totalled by type (Pakistan dates).',
};

const MOVEMENT_LABELS: Record<string, string> = {
  received: 'Received',
  reserved: 'Reserved by orders',
  released: 'Released (order cancelled)',
  packed: 'Packed (left stock)',
  unpacked: 'Unpacked (back to stock)',
  adjusted_in: 'Adjusted in',
  adjusted_out: 'Adjusted out',
  damaged: 'Damaged',
  expired: 'Expired',
  return_restocked: 'Returned and restocked',
  return_written_off: 'Written off (returns and refunds)',
};

export async function inventoryReport(query: InventoryQuery) {
  const range = resolveRange(query.from, query.to);
  const now = new Date();

  const [stock, expiry, lowStock, movements] = await Promise.all([
    stockNow(now),
    getExpiryAlerts(EXPIRY_WARNING_DAYS),
    getLowStockAlerts(),
    StockMovement.aggregate<{ _id: string; units: number; entries: number }>([
      { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
      { $group: { _id: '$type', units: { $sum: '$quantity' }, entries: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    asOf: now.toISOString(),
    range: { from: range.from, to: range.to }, // for movements only
    summary: {
      sizes: stock.rows.length,
      onHandUnits: stock.rows.reduce((s, r) => s + r.onHand, 0),
      availableUnits: stock.rows.reduce((s, r) => s + r.available, 0),
      reservedUnits: stock.rows.reduce((s, r) => s + r.reserved, 0),
      stockValue: stock.value,
      stockValueComplete: stock.sizesWithoutCost.length === 0,
      lowStockSizes: lowStock.length,
      expiringSoonBatches: expiry.expiringSoon.length,
      stoppedSellingBatches: expiry.stoppedSelling.length,
    },
    stock: stock.rows,
    lowStock,
    expiringSoon: expiry.expiringSoon,
    stoppedSelling: expiry.stoppedSelling,
    movements: movements.map((m) => ({ type: m._id, label: MOVEMENT_LABELS[m._id] ?? m._id, units: m.units, entries: m.entries })),
    sizesWithoutCost: stock.sizesWithoutCost,
    definitions: INVENTORY_DEFINITIONS,
  };
}

// Every active size with its stock right now, worked out from its batches
async function stockNow(now: Date) {
  const variantFilter: Record<string, unknown> = { status: 'active' };
  const variants = await Variant.find(variantFilter)
    .select('product sku label costPrice reservedQty availableQty lowStockThreshold')
    .populate<{ product: { _id: Types.ObjectId; name: string; status: string } | null }>('product', 'name status')
    .lean();
  const live = variants.filter((v) => v.product && v.product.status !== 'archived');

  const batchFilter: Record<string, unknown> = {
    variant: mongoose.trusted({ $in: live.map((v) => v._id) }),
    status: 'active',
    quantityRemaining: mongoose.trusted({ $gt: 0 }),
  };
  const batches = await Batch.find(batchFilter).select('variant quantityRemaining expiryDate unitCost').lean();

  const byVariant = new Map<string, typeof batches>();
  for (const b of batches) {
    const key = String(b.variant);
    byVariant.set(key, [...(byVariant.get(key) ?? []), b]);
  }

  let value = 0;
  const sizesWithoutCost: string[] = [];

  const rows = live.map((v) => {
    const own = byVariant.get(String(v._id)) ?? [];
    let onHand = 0;
    let sellable = 0;
    let rowValue = 0;
    let costMissing = false;

    for (const b of own) {
      onHand += b.quantityRemaining;
      if (!isPastSellCutoff(b.expiryDate, now)) sellable += b.quantityRemaining;
      const cost = b.unitCost ?? v.costPrice;
      if (cost === undefined) costMissing = true;
      else rowValue += cost * b.quantityRemaining;
    }
    if (costMissing) sizesWithoutCost.push(`${v.sku} (${v.product!.name} ${v.label})`);
    value += rowValue;

    const threshold = v.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
    return {
      variantId: String(v._id),
      product: v.product!.name,
      sku: v.sku,
      label: v.label,
      onHand,
      sellable,
      reserved: v.reservedQty,
      available: v.availableQty,
      threshold,
      low: v.availableQty <= threshold,
      stockValue: rowValue,
      costMissing,
    };
  });

  rows.sort((a, b) => a.product.localeCompare(b.product) || a.sku.localeCompare(b.sku));
  return { rows, value, sizesWithoutCost };
}