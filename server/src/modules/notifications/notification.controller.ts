import type { Request, Response } from 'express';
import * as templatesService from './templates.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { templateKeySchema, type PreviewTemplateInput, type UpdateTemplateInput } from './templates.validation.js';

type KeyParams = { key: string };

export async function listTemplates(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await templatesService.listTemplates()) });
}

export async function updateTemplate(req: Request<KeyParams>, res: Response): Promise<void> {
  const key = parseOrThrow(templateKeySchema, req.params.key);
  const template = await templatesService.updateTemplate(key, req.body as UpdateTemplateInput, actorFrom(req));
  res.json({ success: true, template });
}

export async function previewTemplate(req: Request<KeyParams>, res: Response): Promise<void> {
  const key = parseOrThrow(templateKeySchema, req.params.key);
  const preview = await templatesService.previewTemplate(key, (req.body ?? {}) as PreviewTemplateInput);
  res.json({ success: true, preview });
}