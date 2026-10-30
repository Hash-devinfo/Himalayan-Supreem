import type { Request, Response } from 'express';
import * as variantService from './variant.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import type {
  ChangeVariantStatusInput,
  CreateVariantInput,
  UpdateVariantInput,
} from './variant.validation.js';

type ProductParams = { productId: string };
type VariantParams = { productId: string; variantId: string };

export async function list(req: Request<ProductParams>, res: Response): Promise<void> {
  const variants = await variantService.listVariants(req.params.productId);
  res.json({ success: true, variants });
}

export async function create(req: Request<ProductParams>, res: Response): Promise<void> {
  const input = req.body as CreateVariantInput;
  const variant = await variantService.createVariant(req.params.productId, input, actorFrom(req));
  res.status(201).json({ success: true, variant });
}

export async function update(req: Request<VariantParams>, res: Response): Promise<void> {
  const { productId, variantId } = req.params;
  const input = req.body as UpdateVariantInput;
  const variant = await variantService.updateVariant(productId, variantId, input, actorFrom(req));
  res.json({ success: true, variant });
}

export async function changeStatus(req: Request<VariantParams>, res: Response): Promise<void> {
  const { productId, variantId } = req.params;
  const { status } = req.body as ChangeVariantStatusInput;
  const variant = await variantService.changeVariantStatus(productId, variantId, status, actorFrom(req));
  res.json({ success: true, variant });
}