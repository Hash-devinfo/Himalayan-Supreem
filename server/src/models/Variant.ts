import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  SIZE_UNITS,
  VARIANT_STATUSES,
  type SizeUnit,
  type VariantStatus,
} from '../constants/enums.js';

export interface IVariant {
  product: Types.ObjectId;
  sku: string;
  label: string;
  sizeValue: number;
  sizeUnit: SizeUnit;
  price: number;
  costPrice?: number;
  shippingWeightGrams: number;
  lowStockThreshold?: number;
  reservedQty: number;
  availableQty: number;
  status: VariantStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type VariantDocument = HydratedDocument<IVariant>;

// Money and quantities are whole numbers (no paisa, no half units).
const wholeNumber = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};

const variantSchema = new Schema<IVariant>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'SKU can only contain letters, numbers and hyphens'],
      maxlength: 40,
    },
    label: {
      type: String,
      required: [true, 'Variant label is required'],
      trim: true,
      maxlength: [40, 'Label cannot be longer than 40 characters'],
    },
    sizeValue: {
      type: Number,
      required: [true, 'Size value is required'],
      min: [0.01, 'Size value must be greater than 0'],
    },
    sizeUnit: {
      type: String,
      enum: SIZE_UNITS,
      required: [true, 'Size unit is required'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      validate: wholeNumber,
    },
    costPrice: {
      type: Number,
      min: [0, 'Cost price cannot be negative'],
      validate: wholeNumber,
    },
    shippingWeightGrams: {
      type: Number,
      required: [true, 'Shipping weight is required'],
      min: [1, 'Shipping weight must be at least 1 gram'],
      validate: wholeNumber,
    },
    lowStockThreshold: {
      type: Number,
      min: 0,
      validate: wholeNumber,
    },
    reservedQty: {
      type: Number,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative'],
      validate: wholeNumber,
    },
    availableQty: {
      type: Number,
      default: 0,
      min: [0, 'Available quantity cannot be negative'],
      validate: wholeNumber,
    },
    status: {
      type: String,
      enum: VARIANT_STATUSES,
      default: 'active',
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

variantSchema.index({ product: 1, status: 1, sortOrder: 1 });

const Variant = model<IVariant>('Variant', variantSchema);

export default Variant;