import type { Request, Response } from 'express';
import * as settingsService from './settings.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import type { UpdateSettingsInput } from './settings.validation.js';

export async function get(_req: Request, res: Response): Promise<void> {
  const settings = await settingsService.getSettings();
  res.json({ success: true, settings });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateSettingsInput;
  const settings = await settingsService.updateSettings(input, actorFrom(req));
  res.json({ success: true, settings });
}