import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  CANCELLATION_REQUEST_STATUSES,
  CANCELLATION_SOURCES,
  CONTACT_OUTCOMES,
  COURIERS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PROVINCES,
  REMITTANCE_STATUSES,
  RETURN_DECISIONS,
  type CancellationRequestStatus,
  type CancellationSource,
  type ContactOutcome,
  type Courier,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type Province,
  type RemittanceStatus,
  type ReturnDecision,
} from '../constants/enums.js';

// ── Types ─────────────────────────────────────────────

export interface OrderAddress {
  line1: string;
  line2?: string;
  area?: string;
  city: string;
  cityRef?: Types.ObjectId; // the City record (also set for typed cities, once saved)
  cityUnlisted: boolean; // typed by the customer under "My city isn't listed"
  province: Province;
}

export interface CustomerSnapshot {
  name: string;
  phone: string;
  email?: string;
  address: OrderAddress;
}

export interface BatchAllocation {
  batch: Types.ObjectId;
  batchNumber: string;
  expiryDate: Date;
  qty: number;
}

// Names and prices are COPIED at order time, so later product edits never change an old order
export interface OrderItem {
  product: Types.ObjectId;
  variant: Types.ObjectId;
  name: string;
  variantLabel: string;
  sku: string;
  unitPrice: number;
  unitCost?: number;
  qty: number;
  discount: number;
  lineTotal: number;
  batchAllocations: BatchAllocation[]; // filled at packing
}

export interface OrderPricing {
  subtotal: number;
  discountTotal: number;
  deliveryCharge: number;
  total: number;
}

export interface OrderDeliveryZone {
  zone: Types.ObjectId;
  name: string;
  estimateText: string;
}

export interface OrderPayment {
  method: PaymentMethod;
  status: PaymentStatus;
  amountCollected?: number;
  collectedAt?: Date;
  remittanceStatus?: RemittanceStatus;
  remittedAt?: Date;
  remittanceRef?: string;
  provider?: string;
  providerRef?: string;
}

export interface StatusChange {
  status: OrderStatus;
  at: Date;
  by?: Types.ObjectId; // admin; empty when the customer placed the order
  note?: string;
}

export interface ContactAttempt {
  attemptNo: number;
  at: Date;
  outcome: ContactOutcome;
  note?: string;
  by?: Types.ObjectId;
}

export interface OrderCancellation {
  requestStatus?: CancellationRequestStatus;
  requestedVia?: CancellationSource;
  requestedAt?: Date;
  reason?: string;
  confirmedOnCall?: boolean;
  decidedAt?: Date;
  decidedBy?: Types.ObjectId;
}

export interface OrderFulfillment {
  courier?: Courier;
  trackingNumber?: string;
  dispatchedAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  returnedAt?: Date;
  returnDecision?: ReturnDecision;
  courierFee?: number;
  codCharge?: number;
  packagingCost?: number;
}

export interface OrderFlags {
  stockShortfall: boolean;
  unlistedCity: boolean;
}

export interface OrderSource {
  sessionId?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface IOrder {
  orderNumber: string;
  customer: Types.ObjectId;
  customerSnapshot: CustomerSnapshot;
  items: OrderItem[];
  pricing: OrderPricing;
  deliveryZone: OrderDeliveryZone;
  payment: OrderPayment;
  status: OrderStatus;
  statusHistory: StatusChange[];
  contactAttempts: ContactAttempt[];
  cancellation: OrderCancellation;
  fulfillment: OrderFulfillment;
  flags: OrderFlags;
  adminNotes?: string;
  source: OrderSource;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<IOrder>;

// ── Schemas ───────────────────────────────────────────

const wholeNumber = { validator: Number.isInteger, message: '{PATH} must be a whole number' };
const rupees = { type: Number, min: 0, validate: wholeNumber };

const addressSchema = new Schema<OrderAddress>(
  {
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    area: { type: String, trim: true, maxlength: 100 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    cityRef: { type: Schema.Types.ObjectId, ref: 'City' },
    cityUnlisted: { type: Boolean, default: false },
    province: { type: String, enum: PROVINCES, required: true },
  },
  { _id: false }
);

const customerSnapshotSchema = new Schema<CustomerSnapshot>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    address: { type: addressSchema, required: true },
  },
  { _id: false }
);

const batchAllocationSchema = new Schema<BatchAllocation>(
  {
    batch: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    batchNumber: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    qty: { type: Number, required: true, min: 1, validate: wholeNumber },
  },
  { _id: false }
);

const orderItemSchema = new Schema<OrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    name: { type: String, required: true },
    variantLabel: { type: String, required: true },
    sku: { type: String, required: true },
    unitPrice: { ...rupees, required: true },
    unitCost: rupees,
    qty: { type: Number, required: true, min: 1, validate: wholeNumber },
    discount: { ...rupees, default: 0 },
    lineTotal: { ...rupees, required: true },
    batchAllocations: { type: [batchAllocationSchema], default: [] },
  },
  { _id: false }
);

const pricingSchema = new Schema<OrderPricing>(
  {
    subtotal: { ...rupees, required: true },
    discountTotal: { ...rupees, default: 0 },
    deliveryCharge: { ...rupees, required: true },
    total: { ...rupees, required: true },
  },
  { _id: false }
);

const deliveryZoneSchema = new Schema<OrderDeliveryZone>(
  {
    zone: { type: Schema.Types.ObjectId, ref: 'DeliveryZone', required: true },
    name: { type: String, required: true },
    estimateText: { type: String, required: true },
  },
  { _id: false }
);

const paymentSchema = new Schema<OrderPayment>(
  {
    method: { type: String, enum: PAYMENT_METHODS, required: true, default: 'cod' },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'pending' },
    amountCollected: rupees,
    collectedAt: { type: Date },
    remittanceStatus: { type: String, enum: REMITTANCE_STATUSES },
    remittedAt: { type: Date },
    remittanceRef: { type: String, trim: true, maxlength: 100 },
    provider: { type: String, trim: true },
    providerRef: { type: String, trim: true },
  },
  { _id: false }
);

const statusChangeSchema = new Schema<StatusChange>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'Admin' },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const contactAttemptSchema = new Schema<ContactAttempt>(
  {
    attemptNo: { type: Number, required: true, min: 1 }, // the service allows at most 3 unanswered calls
    at: { type: Date, required: true, default: Date.now },
    outcome: { type: String, enum: CONTACT_OUTCOMES, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    by: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { _id: false }
);

const cancellationSchema = new Schema<OrderCancellation>(
  {
    requestStatus: { type: String, enum: CANCELLATION_REQUEST_STATUSES },
    requestedVia: { type: String, enum: CANCELLATION_SOURCES },
    requestedAt: { type: Date },
    reason: { type: String, trim: true, maxlength: 500 },
    confirmedOnCall: { type: Boolean },
    decidedAt: { type: Date },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { _id: false }
);

const fulfillmentSchema = new Schema<OrderFulfillment>(
  {
    courier: { type: String, enum: COURIERS },
    trackingNumber: { type: String, trim: true, maxlength: 60 },
    dispatchedAt: { type: Date },
    deliveredAt: { type: Date },
    failedAt: { type: Date },
    failureReason: { type: String, trim: true, maxlength: 500 },
    returnedAt: { type: Date },
    returnDecision: { type: String, enum: RETURN_DECISIONS },
    courierFee: rupees,
    codCharge: rupees,
    packagingCost: rupees,
  },
  { _id: false }
);

const flagsSchema = new Schema<OrderFlags>(
  {
    stockShortfall: { type: Boolean, default: false },
    unlistedCity: { type: Boolean, default: false },
  },
  { _id: false }
);

const sourceSchema = new Schema<OrderSource>(
  {
    sessionId: { type: String },
    referrer: { type: String, trim: true, maxlength: 500 },
    utmSource: { type: String, trim: true, maxlength: 100 },
    utmMedium: { type: String, trim: true, maxlength: 100 },
    utmCampaign: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerSnapshot: { type: customerSnapshotSchema, required: true },
    items: {
      type: [orderItemSchema],
      validate: { validator: (items: OrderItem[]) => items.length > 0, message: 'An order needs at least one item' },
    },
    pricing: { type: pricingSchema, required: true },
    deliveryZone: { type: deliveryZoneSchema, required: true },
    payment: { type: paymentSchema, default: () => ({}) },
    status: { type: String, enum: ORDER_STATUSES, default: 'new' },
    statusHistory: { type: [statusChangeSchema], default: [] },
    contactAttempts: { type: [contactAttemptSchema], default: [] },
    cancellation: { type: cancellationSchema, default: () => ({}) },
    fulfillment: { type: fulfillmentSchema, default: () => ({}) },
    flags: { type: flagsSchema, default: () => ({}) },
    adminNotes: { type: String, trim: true, maxlength: 2000 },
    source: { type: sourceSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'customerSnapshot.phone': 1 });
orderSchema.index({ 'fulfillment.trackingNumber': 1 }, { sparse: true });

const Order = model<IOrder>('Order', orderSchema);

export default Order;