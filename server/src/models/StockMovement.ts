import { Schema, model, type MongooseQueryMiddleware, type Types } from 'mongoose';
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from '../constants/enums.js';

export interface IStockMovement {
  type: StockMovementType;
  variant: Types.ObjectId;
  product: Types.ObjectId;
  batch?: Types.ObjectId;
  quantity: number;
  order?: Types.ObjectId;
  reason?: string;
  admin?: Types.ObjectId;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    type: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
    variant: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    batch: { type: Schema.Types.ObjectId, ref: 'Batch' },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    reason: { type: String, trim: true, maxlength: 500 },
    admin: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

stockMovementSchema.index({ variant: 1, createdAt: -1 });
stockMovementSchema.index({ batch: 1, createdAt: -1 });
stockMovementSchema.index({ order: 1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });

// Append-only, like the audit log: the stock history can never be rewritten.
const blockedOperations: MongooseQueryMiddleware[] = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];

stockMovementSchema.pre(blockedOperations, function () {
  throw new Error('Stock movements cannot be changed or deleted');
});

stockMovementSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Stock movements cannot be changed');
  }
});

const StockMovement = model<IStockMovement>('StockMovement', stockMovementSchema);

export default StockMovement;