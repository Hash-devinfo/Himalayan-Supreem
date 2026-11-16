import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  DISCOUNT_TYPES,
  PROMOTION_AUDIENCES,
  PROMOTION_STATUSES,
  PROMOTION_TYPES,
  type DiscountType,
  type PromotionAudience,
  type PromotionStatus,
  type PromotionType,
} from '../constants/enums.js';

export interface IPromotion {
  name: string; // shown to customers in the cart, e.g. "Eid sale"
  type: PromotionType;
  code?: string; // discount codes only, stored in capitals
  audience: PromotionAudience;
  discountType: DiscountType;
  value: number; // percent (1-100) or rupees
  maxDiscount?: number; // percent codes: the most one order can get
  appliesTo: { products: Types.ObjectId[]; categories: Types.ObjectId[] }; // both empty = whole store
  minOrderTotal?: number; // codes: items total needed
  startsAt: Date;
  endsAt?: Date; // the moment it stops (start of the day after the last day, Pakistan time)
  usageLimit?: number; // codes: total uses
  perCustomerLimit?: number; // codes: uses per phone number
  usageCount: number;
  status: PromotionStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type PromotionDocument = HydratedDocument<IPromotion>;

const wholeNumber = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

const promotionSchema = new Schema<IPromotion>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: PROMOTION_TYPES, required: true },
    code: { type: String, trim: true, uppercase: true, maxlength: 30 },
    audience: { type: String, enum: PROMOTION_AUDIENCES, default: 'all' },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    value: { type: Number, required: true, min: 1, validate: wholeNumber },
    maxDiscount: { type: Number, min: 1, validate: wholeNumber },
    appliesTo: {
      products: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] },
      categories: { type: [{ type: Schema.Types.ObjectId, ref: 'Category' }], default: [] },
    },
    minOrderTotal: { type: Number, min: 0, validate: wholeNumber },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date },
    usageLimit: { type: Number, min: 1, validate: wholeNumber },
    perCustomerLimit: { type: Number, min: 1, validate: wholeNumber },
    usageCount: { type: Number, default: 0, min: 0, validate: wholeNumber },
    status: { type: String, enum: PROMOTION_STATUSES, default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

// One promotion per code ("EID10" and "eid10" are the same code)
promotionSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } });
promotionSchema.index({ status: 1, type: 1, startsAt: 1 });

const Promotion = model<IPromotion>('Promotion', promotionSchema);

export default Promotion;