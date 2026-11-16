import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import AuditLog from '../src/models/AuditLog.js';
import Product from '../src/models/Product.js';
import Review from '../src/models/Review.js';
import { valuesForOrder } from '../src/modules/notifications/templates.js';
import { listProductReviews, submitReviews } from '../src/modules/reviews/review.service.js';
import { submitReviewsSchema } from '../src/modules/reviews/review.validation.js';
import { listReviews, moderateReview } from '../src/modules/reviews/reviewAdmin.service.js';
import { moderateReviewSchema } from '../src/modules/reviews/reviewAdmin.validation.js';
import { getSettings } from '../src/modules/settings/settings.service.js';
import { actor, createStore, createVariant, deliveredOrder, findOrder, order, receive } from './helpers/fixtures.js';

// Two delivered orders of the same product, each with a review (5 and 3 stars), waiting for the admin
async function twoPendingReviews() {
  const { product, cityId } = await createStore();
  const size = await createVariant(product._id);
  await receive(size, 'B1', 10, 200);
  for (const rating of [5, 3]) {
    const orderNumber = await deliveredOrder([{ variant: size, qty: 1 }], cityId);
    const { phone } = (await findOrder(orderNumber)).customerSnapshot;
    await submitReviews(submitReviewsSchema.parse({ orderNumber, phone, reviews: [{ productId: product.id, rating, body: `TEST ${rating} stars` }] }));
  }
  const reviews = await Review.find().sort({ rating: -1 });
  return { product, five: reviews[0]!, three: reviews[1]! };
}

async function stars(productId: unknown) {
  const p = await Product.findById(productId).lean();
  return { avg: p!.ratingAvg, count: p!.ratingCount };
}

describe('Admin review moderation', () => {
  it('new reviews wait in the Pending list', async () => {
    await twoPendingReviews();
    const list = await listReviews({ status: 'pending', page: 1, limit: 20 });
    expect(list.total).toBe(2);
    expect(list.counts).toMatchObject({ pending: 2, published: 0 });
  });

  it('publishing shows the review and updates the product stars', async () => {
    const { product, five, three } = await twoPendingReviews();

    await moderateReview(five.id, { status: 'published' }, actor);
    expect(await stars(product._id)).toEqual({ avg: 5, count: 1 });

    await moderateReview(three.id, { status: 'published' }, actor);
    expect(await stars(product._id)).toEqual({ avg: 4, count: 2 });
    expect((await listProductReviews(product.slug, { page: 1, limit: 10 })).total).toBe(2);
  });

  it('hiding or removing takes it off the website and out of the stars, with a reason', async () => {
    const { product, five, three } = await twoPendingReviews();
    await moderateReview(five.id, { status: 'published' }, actor);
    await moderateReview(three.id, { status: 'published' }, actor);

    await moderateReview(three.id, moderateReviewSchema.parse({ status: 'hidden', note: 'TEST mentions a medical claim' }), actor);
    expect(await stars(product._id)).toEqual({ avg: 5, count: 1 });

    await moderateReview(five.id, moderateReviewSchema.parse({ status: 'removed', note: 'TEST abusive' }), actor);
    expect(await stars(product._id)).toEqual({ avg: 0, count: 0 });
    expect((await listProductReviews(product.slug, { page: 1, limit: 10 })).total).toBe(0);
    expect(await AuditLog.countDocuments({ entityType: 'Review' })).toBe(4);
  });

  it('a reason is required to hide or remove, not to publish', () => {
    expect(moderateReviewSchema.safeParse({ status: 'hidden' }).success).toBe(false);
    expect(moderateReviewSchema.safeParse({ status: 'removed', note: 'x' }).success).toBe(false);
    expect(moderateReviewSchema.safeParse({ status: 'published' }).success).toBe(true);
    expect(moderateReviewSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('the same decision twice is refused', async () => {
    const { five } = await twoPendingReviews();
    await moderateReview(five.id, { status: 'published' }, actor);
    await expect(moderateReview(five.id, { status: 'published' }, actor)).rejects.toThrow(/already published/);
  });

  it('admin review routes need a login', async () => {
    expect((await request(app).get('/api/admin/reviews')).status).toBe(401);
    expect((await request(app).patch('/api/admin/reviews/0123456789abcdef01234567/status').send({ status: 'published' })).status).toBe(401);
  });
});

describe('Review link in the Delivered message', () => {
  it('{{reviewLink}} is filled only once the order is delivered', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 10, 200);
    const settings = await getSettings();

    const placed = await order([{ variant: size, qty: 1 }], cityId);
    expect(valuesForOrder(await findOrder(placed.orderNumber), settings).reviewLink).toBe('');

    const orderNumber = await deliveredOrder([{ variant: size, qty: 1 }], cityId);
    const link = valuesForOrder(await findOrder(orderNumber), settings).reviewLink;
    expect(link).toMatch(new RegExp(`^http://localhost:5173/review\\?order=${orderNumber}&code=[A-Za-z0-9_-]{43}$`));
  });
});