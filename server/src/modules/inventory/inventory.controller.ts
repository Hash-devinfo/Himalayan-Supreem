import type { Request, Response } from 'express';
import * as inventoryService from './inventory.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import {
  expiringQuerySchema,
  listBatchesQuerySchema,
  movementsQuerySchema,
  type AdjustStockInput,
  type ReceiveBatchInput,
  type UpdateBatchInput,
} from './inventory.validation.js';

type VariantParams = { productId: string; variantId: string };
type BatchParams = VariantParams & { batchId: string };

// ── Batches of one size ───────────────────────────────

export async function listBatches(req: Request<VariantParams>, res: Response): Promise<void> {
  const { productId, variantId } = req.params;
  const query = parseOrThrow(listBatchesQuerySchema, req.query);
  const result = await inventoryService.listBatches(productId, variantId, query);
  res.json({ success: true, ...result });
}

export async function receiveBatch(req: Request<VariantParams>, res: Response): Promise<void> {
  const { productId, variantId } = req.params;
  const input = req.body as ReceiveBatchInput;
  const result = await inventoryService.receiveBatch(productId, variantId, input, actorFrom(req));
  res.status(201).json({ success: true, ...result });
}

export async function updateBatch(req: Request<BatchParams>, res: Response): Promise<void> {
  const { productId, variantId, batchId } = req.params;
  const input = req.body as UpdateBatchInput;
  const batch = await inventoryService.updateBatch(productId, variantId, batchId, input, actorFrom(req));
  res.json({ success: true, batch });
}

export async function adjustStock(req: Request<BatchParams>, res: Response): Promise<void> {
  const { productId, variantId, batchId } = req.params;
  const input = req.body as AdjustStockInput;
  const result = await inventoryService.adjustStock(productId, variantId, batchId, input, actorFrom(req));
  res.json({ success: true, ...result });
}

// ── Store-wide inventory ──────────────────────────────

export async function listMovements(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(movementsQuerySchema, req.query);
  const result = await inventoryService.listMovements(query);
  res.json({ success: true, ...result });
}

export async function expiryAlerts(req: Request, res: Response): Promise<void> {
  const { days } = parseOrThrow(expiringQuerySchema, req.query);
  const alerts = await inventoryService.getExpiryAlerts(days);
  res.json({ success: true, days, ...alerts });
}

export async function lowStockAlerts(_req: Request, res: Response): Promise<void> {
  const items = await inventoryService.getLowStockAlerts();
  res.json({ success: true, items });
}