import type { Request, Response } from 'express';
import * as categoryService from './category.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import {
  listCategoriesQuerySchema,
  type ChangeCategoryStatusInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from './category.validation.js';

type IdParams = { id: string };
type SlugParams = { slug: string };

// ── Public (customers) ────────────────────────────────

export async function listPublic(_req: Request, res: Response): Promise<void> {
  const categories = await categoryService.listPublicCategories();
  res.json({ success: true, categories });
}

export async function getPublicBySlug(req: Request<SlugParams>, res: Response): Promise<void> {
  const category = await categoryService.getPublicCategoryBySlug(req.params.slug);
  res.json({ success: true, category });
}

// ── Admin ─────────────────────────────────────────────

export async function listAdmin(req: Request, res: Response): Promise<void> {
  const { status } = parseOrThrow(listCategoriesQuerySchema, req.query);
  const categories = await categoryService.listAdminCategories(status);
  res.json({ success: true, categories });
}

export async function getById(req: Request<IdParams>, res: Response): Promise<void> {
  const category = await categoryService.getCategoryById(req.params.id);
  res.json({ success: true, category });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateCategoryInput;
  const category = await categoryService.createCategory(input, actorFrom(req));
  res.status(201).json({ success: true, category });
}

export async function update(req: Request<IdParams>, res: Response): Promise<void> {
  const input = req.body as UpdateCategoryInput;
  const category = await categoryService.updateCategory(req.params.id, input, actorFrom(req));
  res.json({ success: true, category });
}

export async function changeStatus(req: Request<IdParams>, res: Response): Promise<void> {
  const { status } = req.body as ChangeCategoryStatusInput;
  const category = await categoryService.changeCategoryStatus(req.params.id, status, actorFrom(req));
  res.json({ success: true, category });
}