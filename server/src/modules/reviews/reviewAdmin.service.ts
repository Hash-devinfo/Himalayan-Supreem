import mongoose, { isValidObjectId, type ClientSession, type Types } from 'mongoose';
import Product from '../../models/Product.js';
import Review from '../../models/Review.js';
import { REVIEW_STATUSES } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { formatPktDate } from '../../utils/dates.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import type { ListReviewsQuery, ModerateReviewInput } from './reviewAdmin.validation.js';

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The product's star rating shown on product cards: published reviews only
export async function refreshProductRating(productId: Types.ObjectId | string, session?: ClientSession): Promise<void> {
  const [stats] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: 'published' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]).session(session ?? null);

  await Product.updateOne(
    { _id: productId },
    { $set: { ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0, ratingCount: stats?.count ?? 0 } },
    { session }
  );
}

// ── List (pending first by default) ───────────────────

export async function listReviews(query: ListReviewsQuery) {
  const filter: Record<string, unknown> = { status: query.status };
  if (query.product) filter.product = new mongoose.Types.ObjectId(query.product);
  if (query.rating) filter.rating = query.rating;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = mongoose.trusted([{ orderNumber: pattern }, { displayName: pattern }]);
  }

  const [reviews, total, counts] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: query.status === 'pending' ? 1 : -1 }) // oldest pending first
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate('product', 'name slug')
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  // How many in each tab (the admin screen shows "Pending (3)")
  const byStatus = Object.fromEntries(REVIEW_STATUSES.map((s) => [s, counts.find((c) => c._id === s)?.count ?? 0]));

  return {
    items: reviews.map((r) => ({
      id: String(r._id),
      product: r.product,
      variantLabel: r.variantLabel,
      orderNumber: r.orderNumber,
      displayName: r.displayName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      moderationNote: r.moderationNote,
      date: formatPktDate(r.createdAt),
    })),
    counts: byStatus,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

// ── Publish, hide or remove ───────────────────────────

export async function moderateReview(id: string, input: ModerateReviewInput, actor: ActorContext) {
  if (!isValidObjectId(id)) throw new AppError('Review not found', 404);

  let result: { id: string; status: string; product: string } | undefined;
  await mongoose.connection.transaction(async (session) => {
    const review = await Review.findById(id).session(session);
    if (!review) throw new AppError('Review not found', 404);
    if (review.status === input.status) throw new AppError(`This review is already ${input.status}`, 409);

    const before = review.status;
    review.status = input.status;
    review.moderationNote = input.status === 'published' ? undefined : input.note;
    review.moderatedBy = new mongoose.Types.ObjectId(actor.adminId);
    review.moderatedAt = new Date();
    await review.save({ session });

    // Publishing or taking down a review changes the product's stars
    await refreshProductRating(review.product, session);

    await recordAudit(
      {
        admin: actor.adminId,
        action: `review.${input.status === 'published' ? 'publish' : input.status === 'hidden' ? 'hide' : 'remove'}`,
        entityType: 'Review',
        entityId: review.id,
        before: { status: before },
        after: { status: input.status, note: input.note, order: review.orderNumber, rating: review.rating },
        ip: actor.ip,
      },
      session
    );
    result = { id: review.id, status: review.status, product: String(review.product) };
  });

  return result!;
}