import mongoose from 'mongoose';
import Order, { type OrderDocument } from '../../models/Order.js';
import Product from '../../models/Product.js';
import Review from '../../models/Review.js';
import { REVIEWABLE_STATUSES } from '../../constants/reviews.js';
import AppError from '../../utils/AppError.js';
import { formatPktDate } from '../../utils/dates.js';
import { isValidReviewToken, reviewLinkExpiresAt } from './reviewLink.js';
import type { ProductReviewsQuery, ReviewAccessInput, SubmitReviewsInput } from './review.validation.js';

// The same message for "no such order" and "wrong phone", so order numbers cannot be guessed
const NOT_FOUND = "We couldn't find an order with that order number and phone number";
const USE_PHONE = 'You can still review with your order number and phone number.';

// "Ayesha Khan" -> "Ayesha K." (enough to feel real, not enough to identify someone)
export function displayNameFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter((word) => /\p{L}/u.test(word)); // words with letters
  const first = parts[0] ?? 'Customer';
  const initial = parts.length > 1 ? parts[parts.length - 1]?.match(/\p{L}/u)?.[0]?.toUpperCase() : undefined;
  return initial ? `${first} ${initial}.` : first;
}

// Checks that this person may review this order (BR-06): it is theirs, and it was delivered
async function findReviewableOrder(input: ReviewAccessInput): Promise<OrderDocument> {
  const order = await Order.findOne({ orderNumber: input.orderNumber });

  if (input.code) {
    if (!order || !isValidReviewToken(order._id, input.code)) throw new AppError(`This review link is not valid. ${USE_PHONE}`, 404);
    if (order.reviewLinkUsedAt) throw new AppError(`This review link has already been used. ${USE_PHONE}`, 410);
    const deliveredAt = order.fulfillment.deliveredAt;
    if (deliveredAt && reviewLinkExpiresAt(deliveredAt) < new Date()) throw new AppError(`This review link has expired. ${USE_PHONE}`, 410);
  } else if (!order || order.customerSnapshot.phone !== input.phone) {
    throw new AppError(NOT_FOUND, 404);
  }

  if (!REVIEWABLE_STATUSES.includes(order.status)) {
    throw new AppError('You can review your products once your order has been delivered', 409);
  }
  return order;
}

// One entry per product in the order (two sizes of the same product = one review)
function productsInOrder(order: OrderDocument) {
  const seen = new Map<string, { productId: string; name: string; variantId: string; variantLabel: string }>();
  for (const item of order.items) {
    const productId = String(item.product);
    if (!seen.has(productId)) {
      seen.set(productId, { productId, name: item.name, variantId: String(item.variant), variantLabel: item.variantLabel });
    }
  }
  return [...seen.values()];
}

// ── For the review form: what this customer can review ──

export async function reviewOptions(input: ReviewAccessInput) {
  const order = await findReviewableOrder(input);
  const reviewed = await Review.find({ order: order._id }).select('product').lean();
  const done = new Set(reviewed.map((r) => String(r.product)));

  const items = productsInOrder(order).map((p) => ({ productId: p.productId, name: p.name, variantLabel: p.variantLabel, reviewed: done.has(p.productId) }));
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerSnapshot.name.split(/\s+/)[0],
    items,
    allReviewed: items.every((i) => i.reviewed),
  };
}

// ── Submit reviews (one or more products of the order at once) ──

export async function submitReviews(input: SubmitReviewsInput) {
  const order = await findReviewableOrder(input);
  const products = new Map(productsInOrder(order).map((p) => [p.productId, p]));

  const ids = input.reviews.map((r) => r.productId);
  if (new Set(ids).size !== ids.length) throw new AppError('Each product can be reviewed only once', 400);
  for (const id of ids) {
    if (!products.has(id)) throw new AppError('You can only review products that were in this order', 400);
  }

  await mongoose.connection.transaction(async (session) => {
    const already = await Review.find({ order: order._id, product: mongoose.trusted({ $in: ids }) }).select('product').session(session).lean();
    if (already.length > 0) {
      const names = already.map((r) => products.get(String(r.product))?.name).join(', ');
      throw new AppError(`You have already reviewed ${names} from this order`, 409);
    }

    await Review.create(
      input.reviews.map((r) => {
        const p = products.get(r.productId)!;
        return {
          product: p.productId,
          variant: p.variantId,
          variantLabel: p.variantLabel,
          order: order._id,
          orderNumber: order.orderNumber,
          customer: order.customer,
          displayName: displayNameFor(order.customerSnapshot.name),
          rating: r.rating,
          title: r.title,
          body: r.body,
          status: 'pending', // shown only after the admin publishes it
        };
      }),
      { session, ordered: true }
    );

    // The review link works once (the order number + phone way still works for the rest)
    if (input.code) {
      await Order.updateOne({ _id: order._id }, { $set: { reviewLinkUsedAt: new Date() } }, { session });
    }
  });

  return {
    submitted: input.reviews.length,
    message: 'Thank you for your review! It will appear on our website after we check it.',
  };
}

// ── Product page: published reviews and the rating summary ──

export async function listProductReviews(slug: string, query: ProductReviewsQuery) {
  const product = await Product.findOne({ slug: slug.toLowerCase(), status: 'published' }).select('_id name');
  if (!product) throw new AppError('Product not found', 404);

  const filter: Record<string, unknown> = { product: product._id, status: 'published' };
  const [reviews, total, stars] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select('displayName rating title body variantLabel createdAt')
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate<{ _id: number; count: number }>([
      { $match: filter },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  let sum = 0;
  for (const s of stars) {
    breakdown[s._id as 1 | 2 | 3 | 4 | 5] = s.count;
    sum += s._id * s.count;
  }

  return {
    summary: { average: total ? Math.round((sum / total) * 10) / 10 : null, count: total, breakdown },
    reviews: reviews.map((r) => ({
      displayName: r.displayName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      variantLabel: r.variantLabel,
      date: formatPktDate(r.createdAt),
      verifiedPurchase: true, // every review comes from a delivered order
    })),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}