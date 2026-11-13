import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { VERIFIED_VIA, type VerifiedVia } from '../constants/enums.js';

// One customer per phone number. Guests are customers too: no account or password needed.
export interface CustomerStats {
  orderCount: number;
  deliveredCount: number;
  totalSpent: number; // PKR, counted when an order is delivered
  lastOrderAt?: Date;
}

export interface ICustomer {
  name: string; // the latest name used
  phone: string; // +923XXXXXXXXX
  email?: string;
  phoneVerified: boolean;
  verifiedVia?: VerifiedVia;
  stats: CustomerStats;
  // Fake-order protection (requirements 4.6): a blocked number cannot order online
  isBlocked: boolean;
  blockedReason?: string;
  blockedAt?: Date;
  blockedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerDocument = HydratedDocument<ICustomer>;

const statsSchema = new Schema<CustomerStats>(
  {
    orderCount: { type: Number, default: 0, min: 0 },
    deliveredCount: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    lastOrderAt: { type: Date },
  },
  { _id: false }
);

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, unique: true, match: [/^\+923\d{9}$/, 'Phone must be stored as +923XXXXXXXXX'] },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    phoneVerified: { type: Boolean, default: false },
    verifiedVia: { type: String, enum: VERIFIED_VIA },
    stats: { type: statsSchema, default: () => ({}) },
    isBlocked: { type: Boolean, default: false },
    blockedReason: { type: String, trim: true, maxlength: 500 },
    blockedAt: { type: Date },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

customerSchema.index({ isBlocked: 1 });

const Customer = model<ICustomer>('Customer', customerSchema);

export default Customer;
