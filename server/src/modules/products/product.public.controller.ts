import type { Request, Response } from 'express';
import * as publicService from './product.public.service.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { listProductsPublicQuerySchema } from './product.validation.js';

type SlugParams = { slug: string };

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listProductsPublicQuerySchema, req.query);
  const result = await publicService.listPublicProducts(query);
  res.json({ success: true, ...result });
}

export async function filters(_req: Request, res: Response): Promise<void> {
  const options = await publicService.getPublicFilterOptions();
  res.json({ success: true, ...options });
}

export async function getBySlug(req: Request<SlugParams>, res: Response): Promise<void> {
  const product = await publicService.getPublicProductBySlug(req.params.slug);
  res.json({ success: true, product });
}