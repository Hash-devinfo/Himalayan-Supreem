import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';
import env from '../../config/env.js';
import { REVIEW_LINK_DAYS } from '../../constants/reviews.js';
import { addDays } from '../../utils/dates.js';

// The secure review link sent after delivery (requirements 3.4).
// The code in the link is a signature of the order ID made with the server's secret key:
// nobody can make one for another order, and nothing secret is stored in the database.
// "Single use" is recorded on the order (reviewLinkUsedAt) once reviews are sent with it.

export function reviewToken(orderId: Types.ObjectId | string): string {
  return createHmac('sha256', env.jwtSecret).update(`review-link:${String(orderId)}`).digest('base64url');
}

export function isValidReviewToken(orderId: Types.ObjectId | string, token: string): boolean {
  const expected = Buffer.from(reviewToken(orderId));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// The storefront page that shows the review form (built with the frontend)
export function reviewLink(order: { _id: Types.ObjectId; orderNumber: string }): string {
  const storefront = env.clientUrls[0] ?? '';
  return `${storefront}/review?order=${encodeURIComponent(order.orderNumber)}&code=${reviewToken(order._id)}`;
}

export function reviewLinkExpiresAt(deliveredAt: Date): Date {
  return addDays(deliveredAt, REVIEW_LINK_DAYS);
}