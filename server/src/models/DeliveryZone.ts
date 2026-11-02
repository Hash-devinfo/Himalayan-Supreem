import { Schema, model, type HydratedDocument } from 'mongoose';

export interface WeightRule {
  upToGrams: number;
  charge: number;
}

export interface IDeliveryZone {
  name: string;
  charge: number;
  estimateText: string;
  weightRules: WeightRule[];
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type DeliveryZoneDocument = HydratedDocument<IDeliveryZone>;

const wholeNumber = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};

const weightRuleSchema = new Schema<WeightRule>(
  {
    upToGrams: { type: Number, required: true, min: 1, validate: wholeNumber },
    charge: { type: Number, required: true, min: 0, validate: wholeNumber },
  },
  { _id: false }
);

const deliveryZoneSchema = new Schema<IDeliveryZone>(
  {
    name: {
      type: String,
      required: [true, 'Zone name is required'],
      unique: true,
      trim: true,
      maxlength: [60, 'Zone name cannot be longer than 60 characters'],
    },
    charge: {
      type: Number,
      required: [true, 'Delivery charge is required'],
      min: [0, 'Delivery charge cannot be negative'],
      validate: wholeNumber,
    },
    estimateText: {
      type: String,
      required: [true, 'Delivery estimate is required'],
      trim: true,
      maxlength: [60, 'Estimate cannot be longer than 60 characters'],
    },
    weightRules: {
      type: [weightRuleSchema],
      default: [],
      validate: {
        // Must be sorted by weight, smallest first, with no repeated weights
        validator: (rules: WeightRule[]) =>
          rules.every((rule, i) => i === 0 || rule.upToGrams > (rules[i - 1] as WeightRule).upToGrams),
        message: 'Weight rules must be in increasing order of weight, with no repeats',
      },
    },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

// At most one zone can be the default ("Other cities")
deliveryZoneSchema.index(
  { isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true }, name: 'one_default_zone' }
);

const DeliveryZone = model<IDeliveryZone>('DeliveryZone', deliveryZoneSchema);

export default DeliveryZone;