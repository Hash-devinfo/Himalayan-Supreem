import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { REVIEW_STATUSES, type ReviewStatus } from '../constants/enums.js';

export interface IReview {
  product: Types.ObjectId;
  variant: Types.ObjectId;
  variantLabel: string;
  order: Types.ObjectId;
  orderNumber: string;
  customer: Types.ObjectId;
  displayName: string; // shown on the website, e.g. "Ayesha K."
  rating: number; // 1-5
  title?: string;
  body?: string;
  status: ReviewStatus;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  moderationNote?: string; // admin only: why it was hidden or removed
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewDocument = HydratedDocument<IReview>;

const reviewSchema = new Schema<IReview>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    variantLabel: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: 'Rating must be a whole number from 1 to 5' },
    },
    title: { type: String, trim: true, maxlength: 100 },
    body: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: REVIEW_STATUSES, default: 'pending' },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    moderatedAt: { type: Date },
    moderationNote: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

// One review per product per order (design: Review indexes)
reviewSchema.index({ order: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

const Review = model<IReview>('Review', reviewSchema);

export default Review;