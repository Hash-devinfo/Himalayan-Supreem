import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  REFUND_REASONS,
  REFUND_STATUSES,
  REFUND_STOCK_ACTIONS,
  type RefundReason,
  type RefundStatus,
  type RefundStockAction,
} from '../constants/enums.js';

// A refund for damaged or incorrect items (design 2.5 #9, F9: item-level, not whole-order)
export interface RefundItem {
  variant: Types.ObjectId;
  name: string; // copied from the order item
  variantLabel: string;
  sku: string;
  qty: number;
  amount: number; // PKR refunded for these units
}

export interface IRefund {
  order: Types.ObjectId;
  orderNumber: string; // copied, for lists and search
  items: RefundItem[];
  reason: RefundReason;
  description: string; // what the customer reported
  amount: number; // sum of item amounts
  status: RefundStatus;
  payoutMethod?: string; // free text until the business decides (e.g. "Bank transfer")
  payoutReference?: string; // transaction ID only; never an account or card number
  stockAction: RefundStockAction;
  rejectionReason?: string;
  requestedBy: Types.ObjectId;
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  paidBy?: Types.ObjectId;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type RefundDocument = HydratedDocument<IRefund>;

const rupees = { type: Number, required: true, min: 0, validate: Number.isInteger };

const refundItemSchema = new Schema<RefundItem>(
  {
    variant: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    name: { type: String, required: true },
    variantLabel: { type: String, required: true },
    sku: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    amount: rupees,
  },
  { _id: false }
);

const refundSchema = new Schema<IRefund>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true },
    items: { type: [refundItemSchema], required: true },
    reason: { type: String, enum: REFUND_REASONS, required: true },
    description: { type: String, required: true, maxlength: 1000 },
    amount: rupees,
    status: { type: String, enum: REFUND_STATUSES, required: true, default: 'requested' },
    payoutMethod: { type: String, maxlength: 100 },
    payoutReference: { type: String, maxlength: 100 },
    stockAction: { type: String, enum: REFUND_STOCK_ACTIONS, required: true, default: 'none' },
    rejectionReason: { type: String, maxlength: 500 },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    decidedAt: { type: Date },
    paidBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    paidAt: { type: Date },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

refundSchema.index({ order: 1, createdAt: -1 });
refundSchema.index({ status: 1, createdAt: -1 });

const Refund = model<IRefund>('Refund', refundSchema);

export default Refund;