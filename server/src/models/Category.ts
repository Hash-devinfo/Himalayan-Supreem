import { Schema, model, type HydratedDocument } from 'mongoose';
import { CATEGORY_STATUSES, type CategoryStatus } from '../constants/enums.js';

export interface ImageInfo {
  url: string;
  publicId: string;
}

export interface ICategory {
  name: string;
  slug: string;
  description?: string;
  image?: ImageInfo;
  sortOrder: number;
  status: CategoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryDocument = HydratedDocument<ICategory>;

const imageSchema = new Schema<ImageInfo>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      maxlength: [60, 'Category name cannot be longer than 60 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers and hyphens'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot be longer than 500 characters'],
    },
    image: imageSchema,
    sortOrder: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: CATEGORY_STATUSES,
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

categorySchema.index({ status: 1, sortOrder: 1 });

const Category = model<ICategory>('Category', categorySchema);

export default Category;