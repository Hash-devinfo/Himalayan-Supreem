import { Router } from 'express';
import { reviewLimiter } from '../../middleware/rateLimiters.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { validateBody } from '../../middleware/validate.js';
import * as reviewController from './review.controller.js';
import * as reviewAdminController from './reviewAdmin.controller.js';
import { reviewAccessSchema, submitReviewsSchema } from './review.validation.js';
import { moderateReviewSchema } from './reviewAdmin.validation.js';

// Public: /api/reviews (customers, no login: order number + phone, or the review link)
export const reviewPublicRoutes = Router();

reviewPublicRoutes.get('/products/:slug', reviewController.forProduct);
reviewPublicRoutes.post('/order', reviewLimiter, validateBody(reviewAccessSchema), reviewController.options);
reviewPublicRoutes.post('/', reviewLimiter, validateBody(submitReviewsSchema), reviewController.submit);

// Admin: /api/admin/reviews (check reviews before they appear on the website)
export const reviewAdminRoutes = Router();

reviewAdminRoutes.use(requireAdmin);

reviewAdminRoutes.get('/', reviewAdminController.list);
reviewAdminRoutes.patch('/:id/status', validateBody(moderateReviewSchema), reviewAdminController.moderate);