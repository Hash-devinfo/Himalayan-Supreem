import { Schema, model, type Types } from 'mongoose';
import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from '../constants/enums.js';

// Anonymous website events (design 2.5 #18). NEVER a name, phone or email: only a random
// visitor ID from a cookie, so events from the same browser can be linked (views -> cart -> order).
export interface IAnalyticsEvent {
  type: AnalyticsEventType;
  visitorId?: string;
  product?: Types.ObjectId;
  variant?: Types.ObjectId;
  orderNumber?: string;
  searchQuery?: string; // long numbers (phones) are masked before saving
  resultCount?: number;
  path?: string; // page path only, never the query string
  source?: { referrer?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string };
  createdAt: Date;
  expiresAt: Date; // deleted automatically after the retention period
}

const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    type: { type: String, enum: ANALYTICS_EVENT_TYPES, required: true },
    visitorId: { type: String },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    variant: { type: Schema.Types.ObjectId, ref: 'Variant' },
    orderNumber: { type: String },
    searchQuery: { type: String, maxlength: 100 },
    resultCount: { type: Number, min: 0 },
    path: { type: String, maxlength: 200 },
    source: {
      referrer: { type: String, maxlength: 200 },
      utmSource: { type: String, maxlength: 100 },
      utmMedium: { type: String, maxlength: 100 },
      utmCampaign: { type: String, maxlength: 100 },
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

analyticsEventSchema.index({ type: 1, createdAt: -1 });
analyticsEventSchema.index({ visitorId: 1, createdAt: 1 });
// TTL index: MongoDB deletes each event when its expiresAt passes
analyticsEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AnalyticsEvent = model<IAnalyticsEvent>('AnalyticsEvent', analyticsEventSchema);

export default AnalyticsEvent;