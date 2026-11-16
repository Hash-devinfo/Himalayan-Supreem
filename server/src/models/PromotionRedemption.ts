import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// Each time an order uses a discount code (design 22). Used for per-customer limits and reports.
// "released" = the order was cancelled, so the use no longer counts.
export interface IPromotionRedemption {
  promotion: Types.ObjectId;
  order: Types.ObjectId;
  orderNumber: string;
  customerPhone: string; // normalised +92 format
  amount: number; // discount given, PKR
  status: 'used' | 'released';
  createdAt: Date;
  updatedAt: Date;
}

export type PromotionRedemptionDocument = HydratedDocument<IPromotionRedemption>;

const redemptionSchema = new Schema<IPromotionRedemption>(
  {
    promotion: { type: Schema.Types.ObjectId, ref: 'Promotion', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true },
    customerPhone: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['used', 'released'], default: 'used' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

redemptionSchema.index({ promotion: 1, customerPhone: 1, status: 1 });
redemptionSchema.index({ order: 1 }, { unique: true }); // one code per order

const PromotionRedemption = model<IPromotionRedemption>('PromotionRedemption', redemptionSchema);

export default PromotionRedemption;