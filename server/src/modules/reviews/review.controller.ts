import type { Request, Response } from 'express';
import { parseOrThrow } from '../../middleware/validate.js';
import * as reviewService from './review.service.js';
import { productReviewsQuerySchema, type ReviewAccessInput, type SubmitReviewsInput } from './review.validation.js';

// Public: what this customer can review (after checking the order is theirs and delivered)
export async function options(req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await reviewService.reviewOptions(req.body as ReviewAccessInput)) });
}

// Public: send one or more reviews
export async function submit(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, ...(await reviewService.submitReviews(req.body as SubmitReviewsInput)) });
}

// Public: published reviews for a product page
export async function forProduct(req: Request<{ slug: string }>, res: Response): Promise<void> {
  const query = parseOrThrow(productReviewsQuerySchema, req.query);
  res.json({ success: true, ...(await reviewService.listProductReviews(req.params.slug, query)) });
}