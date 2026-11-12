import type { Request, Response } from 'express';
import * as templatesService from './templates.service.js';
import * as notificationService from './notification.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { templateKeySchema, type PreviewTemplateInput, type UpdateTemplateInput } from './templates.validation.js';
import { listNotificationsQuerySchema } from './notification.validation.js';

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



// ── Message log ───────────────────────────────────────

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listNotificationsQuerySchema, req.query);
  res.json({ success: true, ...(await notificationService.listNotifications(query)) });
}

export async function retry(req: Request<{ id: string }>, res: Response): Promise<void> {
  const notification = await notificationService.retryNotification(req.params.id, actorFrom(req));
  res.json({ success: true, notification });
}


// ── WhatsApp ──────────────────────────────────────────

export async function whatsappOptions(req: Request<{ order: string }>, res: Response): Promise<void> {
  res.json({ success: true, ...(await notificationService.whatsappOptions(req.params.order)) });
}

export async function prepareWhatsapp(req: Request<{ order: string; key: string }>, res: Response): Promise<void> {
  const key = parseOrThrow(templateKeySchema, req.params.key);
  const result = await notificationService.prepareWhatsapp(req.params.order, key, actorFrom(req));
  res.json({ success: true, ...result });
}