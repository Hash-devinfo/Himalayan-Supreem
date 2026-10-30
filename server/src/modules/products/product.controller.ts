import type { Request, Response } from 'express';
import * as productService from './product.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import {
  listProductsAdminQuerySchema,
  type ChangeProductStatusInput,
  type CreateProductInput,
  type UpdateProductInput,
} from './product.validation.js';

type IdParams = { id: string };

export async function listAdmin(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listProductsAdminQuerySchema, req.query);
  const result = await productService.listAdminProducts(query);
  res.json({ success: true, ...result });
}

export async function getById(req: Request<IdParams>, res: Response): Promise<void> {
  const { product, variants } = await productService.getAdminProduct(req.params.id);
  res.json({ success: true, product, variants });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateProductInput;
  const product = await productService.createProduct(input, actorFrom(req));
  res.status(201).json({ success: true, product });
}

export async function update(req: Request<IdParams>, res: Response): Promise<void> {
  const input = req.body as UpdateProductInput;
  const product = await productService.updateProduct(req.params.id, input, actorFrom(req));
  res.json({ success: true, product });
}

export async function changeStatus(req: Request<IdParams>, res: Response): Promise<void> {
  const { status } = req.body as ChangeProductStatusInput;
  const product = await productService.changeProductStatus(req.params.id, status, actorFrom(req));
  res.json({ success: true, product });
}