import type { Request, Response } from 'express';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import * as reviewAdminService from './reviewAdmin.service.js';
import { listReviewsQuerySchema, type ModerateReviewInput } from './reviewAdmin.validation.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listReviewsQuerySchema, req.query);
  res.json({ success: true, ...(await reviewAdminService.listReviews(query)) });
}

export async function moderate(req: Request<{ id: string }>, res: Response): Promise<void> {
  const review = await reviewAdminService.moderateReview(req.params.id, req.body as ModerateReviewInput, actorFrom(req));
  res.json({ success: true, review });
}