import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { BATCH_STATUSES, type BatchStatus } from '../constants/enums.js';

export interface IBatch {
  variant: Types.ObjectId;
  product: Types.ObjectId;
  batchNumber: string;
  quantityReceived: number;
  quantityRemaining: number;
  receivedDate: Date;
  expiryDate: Date;
  origin?: string;
  certificate?: Types.ObjectId;
  unitCost?: number;
  status: BatchStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BatchDocument = HydratedDocument<IBatch>;

const wholeNumber = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};

const batchSchema = new Schema<IBatch>(
  {
    variant: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'Batch number cannot be longer than 50 characters'],
    },
    quantityReceived: {
      type: Number,
      required: [true, 'Quantity received is required'],
      min: [1, 'Quantity received must be at least 1'],
      validate: wholeNumber,
    },
    quantityRemaining: {
      type: Number,
      required: true,
      min: [0, 'Remaining quantity cannot be negative'],
      validate: wholeNumber,
    },
    receivedDate: { type: Date, required: [true, 'Received date is required'] },
    expiryDate: { type: Date, required: [true, 'Expiry date is required'] },
    origin: { type: String, trim: true, maxlength: 200 },
    certificate: { type: Schema.Types.ObjectId, ref: 'Certificate' },
    unitCost: { type: Number, min: 0, validate: wholeNumber },
    status: { type: String, enum: BATCH_STATUSES, default: 'active' },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

batchSchema.index({ variant: 1, batchNumber: 1 }, { unique: true });
batchSchema.index({ variant: 1, expiryDate: 1 });
batchSchema.index({ expiryDate: 1 });

const Batch = model<IBatch>('Batch', batchSchema);

export default Batch;