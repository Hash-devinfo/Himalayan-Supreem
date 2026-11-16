import type { Request, Response } from 'express';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import * as promotionService from './promotion.service.js';
import { listPromotionsQuerySchema, type CreatePromotionInput, type UpdatePromotionInput } from './promotion.validation.js';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listPromotionsQuerySchema, req.query);
  res.json({ success: true, ...(await promotionService.listPromotions(query)) });
}

export async function get(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await promotionService.getPromotion(req.params.id)) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const promotion = await promotionService.createPromotion(req.body as CreatePromotionInput, actorFrom(req));
  res.status(201).json({ success: true, promotion });
}

export async function update(req: Request<IdParams>, res: Response): Promise<void> {
  const promotion = await promotionService.updatePromotion(req.params.id, req.body as UpdatePromotionInput, actorFrom(req));
  res.json({ success: true, promotion });
}

export async function pause(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, promotion: await promotionService.changePromotionStatus(req.params.id, 'pause', actorFrom(req)) });
}

export async function resume(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, promotion: await promotionService.changePromotionStatus(req.params.id, 'resume', actorFrom(req)) });
}

export async function end(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, promotion: await promotionService.changePromotionStatus(req.params.id, 'end', actorFrom(req)) });
}