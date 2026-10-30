import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { PRODUCT_STATUSES, type ProductStatus } from '../constants/enums.js';

export interface ProductImage {
  url: string;
  publicId: string;
  alt: string;
}

export interface ProductSeo {
  title?: string;
  description?: string;
}

export interface IProduct {
  name: string;
  slug: string;
  category: Types.ObjectId;
  shortDescription?: string;
  description?: string;
  images: ProductImage[];
  ingredients?: string;
  allergens?: string;
  storageInstructions?: string;
  usageDirections?: string;
  origin?: string;
  claims: string[];
  tags: string[];
  certificates: Types.ObjectId[];
  status: ProductStatus;
  seo?: ProductSeo;
  // Cached from variants (kept up to date by the product service)
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  // Cached from published reviews (Release 2)
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<IProduct>;

const productImageSchema = new Schema<ProductImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, required: [true, 'Image alt text is required'], trim: true, maxlength: 150 },
  },
  { _id: false }
);

const seoSchema = new Schema<ProductSeo>(
  {
    title: { type: String, trim: true, maxlength: 70 },
    description: { type: String, trim: true, maxlength: 160 },
  },
  { _id: false }
);

const longText = { type: String, trim: true, maxlength: 2000 };

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [120, 'Product name cannot be longer than 120 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers and hyphens'],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    shortDescription: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    images: { type: [productImageSchema], default: [] },
    ingredients: longText,
    allergens: longText,
    storageInstructions: longText,
    usageDirections: longText,
    origin: { type: String, trim: true, maxlength: 200 },
    claims: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
    tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }], default: [] },
    certificates: { type: [{ type: Schema.Types.ObjectId, ref: 'Certificate' }], default: [] },
    status: {
      type: String,
      enum: PRODUCT_STATUSES,
      default: 'draft',
    },
    seo: seoSchema,
    minPrice: { type: Number, min: 0 },
    maxPrice: { type: Number, min: 0 },
    inStock: { type: Boolean, default: false },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1, minPrice: 1 });
productSchema.index(
  { name: 'text', tags: 'text', description: 'text' },
  { weights: { name: 10, tags: 5, description: 1 }, name: 'product_text_search' }
);

const Product = model<IProduct>('Product', productSchema);

export default Product;