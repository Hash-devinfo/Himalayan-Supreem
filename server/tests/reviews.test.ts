import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import Review from '../src/models/Review.js';
import { reviewToken } from '../src/modules/reviews/reviewLink.js';
import { displayNameFor, listProductReviews, reviewOptions, submitReviews } from '../src/modules/reviews/review.service.js';
import { submitReviewsSchema } from '../src/modules/reviews/review.validation.js';
import { createStore, createVariant, deliveredOrder, findOrder, order, receive } from './helpers/fixtures.js';

// A delivered order for one product, and the phone it was placed with
async function delivered() {
  const { product, cityId } = await createStore();
  const size = await createVariant(product._id);
  await receive(size, 'B1', 10, 200);
  const orderNumber = await deliveredOrder([{ variant: size, qty: 1 }], cityId);
  const placed = await findOrder(orderNumber);
  return { product, size, cityId, orderNumber, phone: placed.customerSnapshot.phone, orderId: placed._id };
}

function review(input: unknown) {
  return submitReviews(submitReviewsSchema.parse(input));
}

describe('Who can review (BR-06)', () => {
  it('a customer with a delivered order can review the product (it waits for the admin)', async () => {
    const { product, orderNumber, phone } = await delivered();

    const options = await reviewOptions({ orderNumber, phone });
    expect(options.items).toEqual([expect.objectContaining({ productId: product.id, reviewed: false })]);

    const result = await review({ orderNumber, phone, reviews: [{ productId: product.id, rating: 5, body: 'TEST very fresh' }] });
    expect(result.submitted).toBe(1);

    const saved = await Review.findOne({ product: product._id }).lean();
    expect(saved).toMatchObject({ rating: 5, status: 'pending', displayName: 'Test F.' });
    expect((await reviewOptions({ orderNumber, phone })).allReviewed).toBe(true);
  });

  it('an order that is not delivered cannot be reviewed', async () => {
    const { product, cityId } = await createStore();
    const size = await createVariant(product._id);
    await receive(size, 'B1', 10, 200);
    const placed = await order([{ variant: size, qty: 1 }], cityId);
    const { phone } = (await findOrder(placed.orderNumber)).customerSnapshot;

    await expect(
      review({ orderNumber: placed.orderNumber, phone, reviews: [{ productId: product.id, rating: 4 }] })
    ).rejects.toThrow(/once your order has been delivered/);
  });

  it('the wrong phone gets the same message as a wrong order number', async () => {
    const { product, orderNumber } = await delivered();
    const wrongPhone = submitReviewsSchema.parse({ orderNumber, phone: '03111111111', reviews: [{ productId: product.id, rating: 4 }] });
    const wrongOrder = submitReviewsSchema.parse({ orderNumber: 'ORD-000000-9999', phone: '03111111111', reviews: [{ productId: product.id, rating: 4 }] });

    await expect(submitReviews(wrongPhone)).rejects.toThrow("We couldn't find an order");
    await expect(submitReviews(wrongOrder)).rejects.toThrow("We couldn't find an order");
  });

  it('only products from that order, and only once per order', async () => {
    const { product, orderNumber, phone } = await delivered();
    const other = await createVariant(product._id); // same product, different size: still one review

    await expect(review({ orderNumber, phone, reviews: [{ productId: other.id, rating: 3 }] })).rejects.toThrow(/only review products that were in this order/);

    await review({ orderNumber, phone, reviews: [{ productId: product.id, rating: 4 }] });
    await expect(review({ orderNumber, phone, reviews: [{ productId: product.id, rating: 1 }] })).rejects.toThrow(/already reviewed/);
    expect(await Review.countDocuments()).toBe(1);
  });
});

describe('The review link sent after delivery', () => {
  it('works once', async () => {
    const { product, orderNumber, orderId } = await delivered();
    const code = reviewToken(orderId);

    await review({ orderNumber, code, reviews: [{ productId: product.id, rating: 5 }] });
    expect((await findOrder(orderNumber)).reviewLinkUsedAt).toBeInstanceOf(Date);

    await expect(reviewOptions({ orderNumber, code })).rejects.toThrow(/already been used/);
  });

  it("a link for another order does not work", async () => {
    const first = await delivered();
    const code = reviewToken(first.orderId);
    const { product } = first;

    await expect(review({ orderNumber: 'ORD-000000-9999', code, reviews: [{ productId: product.id, rating: 5 }] })).rejects.toThrow(/not valid/);
  });
});

describe('Review content and display', () => {
  it('ratings must be 1-5 and HTML is refused', () => {
    const base = { orderNumber: 'ORD-261116-0001', phone: '03001234567' };
    expect(submitReviewsSchema.safeParse({ ...base, reviews: [{ productId: 'a'.repeat(24), rating: 6 }] }).success).toBe(false);
    expect(submitReviewsSchema.safeParse({ ...base, reviews: [{ productId: 'a'.repeat(24), rating: 5, body: '<script>x</script>' }] }).success).toBe(false);
    expect(submitReviewsSchema.safeParse({ ...base, code: reviewToken('x'), reviews: [{ productId: 'a'.repeat(24), rating: 5 }] }).success).toBe(false); // phone OR code
  });

  it('display names show first name and last initial only', () => {
    expect(displayNameFor('Ayesha Khan')).toBe('Ayesha K.');
    expect(displayNameFor('  muhammad ali raza ')).toBe('muhammad R.');
    expect(displayNameFor('Sana')).toBe('Sana');
    expect(displayNameFor('Test Customer (FICTIONAL)')).toBe('Test F.');
  });

  it('the product page shows published reviews only, with the rating summary', async () => {
    const { product, orderNumber, phone } = await delivered();
    await review({ orderNumber, phone, reviews: [{ productId: product.id, rating: 4, title: 'TEST good' }] });

    expect((await listProductReviews(product.slug, { page: 1, limit: 10 })).total).toBe(0); // still pending

    await Review.updateMany({}, { $set: { status: 'published' } }); // the admin publishes it (16B)
    const page = await listProductReviews(product.slug, { page: 1, limit: 10 });
    expect(page.summary).toMatchObject({ average: 4, count: 1, breakdown: { 4: 1, 5: 0 } });
    expect(page.reviews[0]).toMatchObject({ displayName: 'Test F.', rating: 4, title: 'TEST good', verifiedPurchase: true });
    expect(page.reviews[0]).not.toHaveProperty('orderNumber');
  });

  it('HTTP: the public routes work and validate input', async () => {
    const { product, orderNumber, phone } = await delivered();

    const missing = await request(app).post('/api/reviews').send({ orderNumber, phone, reviews: [] });
    expect(missing.status).toBe(400);

    const ok = await request(app).post('/api/reviews').send({ orderNumber, phone: phone.replace('+92', '0'), reviews: [{ productId: product.id, rating: 5 }] });
    expect(ok.status).toBe(201);

    const list = await request(app).get(`/api/reviews/products/${product.slug}`);
    expect(list.status).toBe(200);
    expect(list.body.summary.count).toBe(0);
  });
});