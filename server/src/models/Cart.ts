import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { CART_STATUSES, type CartStatus } from '../constants/enums.js';

export interface CartItem {
  variant: Types.ObjectId;
  quantity: number;
  lastSeenPrice: number; // the price the customer last saw, to tell them if it changes
  addedAt: Date;
}

export interface ICart {
  sessionId: string;
  items: CartItem[];
  status: CartStatus;
  convertedOrder?: Types.ObjectId;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CartDocument = HydratedDocument<ICart>;

const wholeNumber = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

const cartItemSchema = new Schema<CartItem>(
  {
    variant: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    quantity: { type: Number, required: true, min: 1, validate: wholeNumber },
    lastSeenPrice: { type: Number, required: true, min: 0, validate: wholeNumber },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cartSchema = new Schema<ICart>(
  {
    // Random value from the browser's cart cookie
    sessionId: { type: String, required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    status: { type: String, enum: CART_STATUSES, default: 'active' },
    convertedOrder: { type: Schema.Types.ObjectId, ref: 'Order' },
    lastActivityAt: { type: Date, default: Date.now },
    // MongoDB deletes the cart automatically once this time has passed
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    // Two requests changing the same cart at once (a double click, two tabs):
    // the second save fails instead of silently overwriting the first. The service then retries.
    optimisticConcurrency: true,
    toJSON: { versionKey: false },
  }
);

// TTL index: "delete each cart when its expiresAt is reached"
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// For abandoned-cart reports later
cartSchema.index({ status: 1, lastActivityAt: 1 });

const Cart = model<ICart>('Cart', cartSchema);

export default Cart;