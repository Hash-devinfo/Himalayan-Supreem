import type { Request, Response } from 'express';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import * as pageService from './page.service.js';
import { pageSlugSchema, type UpdatePageInput } from './page.validation.js';

type SlugParams = { slug: string };

// ── Admin ─────────────────────────────────────────────

export async function list(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await pageService.listPages()) });
}

export async function get(req: Request<SlugParams>, res: Response): Promise<void> {
  const slug = parseOrThrow(pageSlugSchema, req.params.slug);
  res.json({ success: true, ...(await pageService.getPageForAdmin(slug)) });
}

export async function update(req: Request<SlugParams>, res: Response): Promise<void> {
  const slug = parseOrThrow(pageSlugSchema, req.params.slug);
  res.json({ success: true, ...(await pageService.updatePage(slug, req.body as UpdatePageInput, actorFrom(req))) });
}

export async function approve(req: Request<SlugParams>, res: Response): Promise<void> {
  const slug = parseOrThrow(pageSlugSchema, req.params.slug);
  res.json({ success: true, ...(await pageService.approvePage(slug, actorFrom(req))) });
}

// ── Public ────────────────────────────────────────────

export async function publicList(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await pageService.listPublicPages()) });
}

export async function publicGet(req: Request<SlugParams>, res: Response): Promise<void> {
  const slug = parseOrThrow(pageSlugSchema, req.params.slug);
  res.json({ success: true, ...(await pageService.getPublicPage(slug)) });
}