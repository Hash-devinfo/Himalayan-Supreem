import type { Request, Response } from 'express';
import { actorFrom } from '../../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../../middleware/validate.js';
import * as postexService from './postex.service.js';
import { integrationLogQuerySchema, type MatchCityInput, type PostexSettingsInput } from './postex.validation.js';

export async function status(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, postex: await postexService.postexStatus() });
}

export async function check(req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await postexService.checkConnection(actorFrom(req))) });
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  res.json({ success: true, postex: await postexService.updatePostexSettings(req.body as PostexSettingsInput, actorFrom(req)) });
}

export async function syncCities(req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await postexService.syncPostexCities(actorFrom(req))) });
}

export async function matchCity(req: Request<{ cityId: string }>, res: Response): Promise<void> {
  res.json({ success: true, ...(await postexService.matchCity(req.params.cityId, req.body as MatchCityInput, actorFrom(req))) });
}

export async function logs(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(integrationLogQuerySchema, req.query);
  res.json({ success: true, ...(await postexService.listIntegrationLogs(query)) });
}