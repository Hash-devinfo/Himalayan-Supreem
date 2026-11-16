import { Router } from 'express';
import { reviewLimiter } from '../../middleware/rateLimiters.js';
import { validateBody } from '../../middleware/validate.js';
import * as reviewController from './review.controller.js';
import { reviewAccessSchema, submitReviewsSchema } from './review.validation.js';

// Public: /api/reviews (customers, no login: order number + phone, or the review link)
export const reviewPublicRoutes = Router();

reviewPublicRoutes.get('/products/:slug', reviewController.forProduct);
reviewPublicRoutes.post('/order', reviewLimiter, validateBody(reviewAccessSchema), reviewController.options);
reviewPublicRoutes.post('/', reviewLimiter, validateBody(submitReviewsSchema), reviewController.submit);