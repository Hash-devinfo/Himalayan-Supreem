import mongoose, { type Types } from "mongoose";
import Product from "../../models/Product.js";
import Variant from "../../models/Variant.js";
import Category from "../../models/Category.js";
import type { SizeUnit } from "../../constants/enums.js";
import AppError from "../../utils/AppError.js";
import type { PaginatedResult } from "./product.service.js";
import type { ListProductsPublicQuery } from "./product.validation.js";
import Batch from "../../models/Batch.js";
import { formatPktDate } from "../../utils/dates.js";
import { sellableExpiryCutoff } from '../inventory/expiry.js';

// ── Public shapes: exactly what customers are allowed to see ──

export interface PublicProductCard {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  image?: { url: string; alt: string };
  category?: { name: string; slug: string };
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  ratingAvg: number;
  ratingCount: number;
}

export interface PublicVariant {
  id: string;
  sku: string;
  label: string;
  sizeValue: number;
  sizeUnit: SizeUnit;
  price: number;
  inStock: boolean;
}

export interface PublicProductDetail extends Omit<PublicProductCard, "image"> {
  description?: string;
  images: { url: string; alt: string }[];
  ingredients?: string;
  allergens?: string;
  storageInstructions?: string;
  usageDirections?: string;
  origin?: string;
  claims: string[];
  seo?: { title?: string; description?: string };
  variants: PublicVariant[];
}

export interface SizeOption {
  value: string; // for the URL: "250-g"
  label: string; // for people: "250 g"
}
export interface PublicVariant {
  id: string;
  sku: string;
  label: string;
  sizeValue: number;
  sizeUnit: SizeUnit;
  price: number;
  inStock: boolean;
  // Earliest-expiring batch that can still be sold (shown on the product page)
  batch?: PublicBatchInfo;
}

export interface PublicBatchInfo {
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD (Pakistan)
  origin?: string;
}

const CARD_FIELDS =
  "name slug shortDescription images category minPrice maxPrice inStock ratingAvg ratingCount";

type PopulatedCategory =
  | { name: string; slug: string }
  | Types.ObjectId
  | null
  | undefined;

function categoryInfo(
  category: PopulatedCategory,
): { name: string; slug: string } | undefined {
  if (category && typeof category === "object" && "slug" in category) {
    return { name: category.name, slug: category.slug };
  }
  return undefined;
}

// ── List with search, filters, sorting and pages ──────

export async function listPublicProducts(
  query: ListProductsPublicQuery,
): Promise<PaginatedResult<PublicProductCard>> {
  const { category, search, minPrice, maxPrice, size, inStock, page, limit } =
    query;

  const filter: Record<string, unknown> = { status: "published" };

  if (category) {
    const found = await Category.findOne({
      slug: category,
      status: "active",
    }).select("_id");
    if (!found) {
      throw new AppError("Category not found", 404);
    }
    filter.category = found._id;
  }

  if (search) {
    filter.$text = mongoose.trusted({ $search: search });
  }

  // A product matches if any of its sizes falls inside the price range.
  if (maxPrice !== undefined) {
    filter.minPrice = mongoose.trusted({ $lte: maxPrice });
  }
  if (minPrice !== undefined) {
    filter.maxPrice = mongoose.trusted({ $gte: minPrice });
  }

  if (inStock === true) {
    filter.inStock = true;
  }

  if (size) {
    const [valueText, unit] = size.split("-");
    const sizeFilter: Record<string, unknown> = {
      status: "active",
      sizeValue: Number(valueText),
      sizeUnit: unit,
    };
    const productIds = await Variant.distinct("product", sizeFilter);
    filter._id = mongoose.trusted({ $in: productIds });
  }

  const sortKey = query.sort ?? (search ? "relevance" : "newest");
  const useTextScore = sortKey === "relevance" && Boolean(search);

  const sortOptions: Record<
    string,
    Record<string, 1 | -1 | { $meta: "textScore" }>
  > = {
    relevance: { score: { $meta: "textScore" } },
    newest: { createdAt: -1 },
    price_asc: { minPrice: 1, name: 1 },
    price_desc: { maxPrice: -1, name: 1 },
    name: { name: 1 },
  };
  const sort = useTextScore
    ? sortOptions.relevance
    : (sortOptions[sortKey] ?? sortOptions.newest);

  let findQuery = Product.find(filter).select(CARD_FIELDS);
  if (useTextScore) {
    findQuery = findQuery.select({ score: { $meta: "textScore" } });
  }

  const [docs, total] = await Promise.all([
    findQuery
      .populate("category", "name slug")
      .sort(sort ?? { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const items: PublicProductCard[] = docs.map((doc) => {
    const firstImage = doc.images[0];
    return {
      id: doc._id.toString(),
      name: doc.name,
      slug: doc.slug,
      shortDescription: doc.shortDescription,
      image: firstImage
        ? { url: firstImage.url, alt: firstImage.alt }
        : undefined,
      category: categoryInfo(doc.category as PopulatedCategory),
      minPrice: doc.minPrice,
      maxPrice: doc.maxPrice,
      inStock: doc.inStock,
      ratingAvg: doc.ratingAvg,
      ratingCount: doc.ratingCount,
    };
  });

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

// ── One product page ──────────────────────────────────
// For each size, the batch a customer would most likely receive:
// the sellable batch that expires first (first-expiry, first-out).
async function earliestSellableBatches(
  variantIds: Types.ObjectId[],
): Promise<Map<string, PublicBatchInfo>> {
  const result = new Map<string, PublicBatchInfo>();
  if (variantIds.length === 0) return result;

  const filter: Record<string, unknown> = {
    variant: mongoose.trusted({ $in: variantIds }),
    status: "active",
    quantityRemaining: mongoose.trusted({ $gt: 0 }),
    expiryDate: mongoose.trusted({ $gt: sellableExpiryCutoff() }),
  };

  const batches = await Batch.find(filter)
    .select("variant batchNumber expiryDate origin")
    .sort({ expiryDate: 1 })
    .lean();

  for (const batch of batches) {
    const key = batch.variant.toString();
    if (!result.has(key)) {
      result.set(key, {
        batchNumber: batch.batchNumber,
        expiryDate: formatPktDate(batch.expiryDate),
        origin: batch.origin,
      });
    }
  }

  return result;
}

export async function getPublicProductBySlug(
  slug: string,
): Promise<PublicProductDetail> {
  const product = await Product.findOne({ slug, status: "published" })
    .populate("category", "name slug")
    .lean();

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const variants = await Variant.find({
    product: product._id,
    status: "active",
  })
    .sort({ sortOrder: 1, sizeValue: 1 })
    .lean();

  const batchByVariant = await earliestSellableBatches(
    variants.map((variant) => variant._id),
  );
  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    category: categoryInfo(product.category as PopulatedCategory),
    shortDescription: product.shortDescription,
    description: product.description,
    images: product.images.map((image) => ({ url: image.url, alt: image.alt })),
    ingredients: product.ingredients,
    allergens: product.allergens,
    storageInstructions: product.storageInstructions,
    usageDirections: product.usageDirections,
    origin: product.origin,
    claims: product.claims,
    seo: product.seo,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    inStock: product.inStock,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    variants: variants.map((variant) => ({
      id: variant._id.toString(),
      sku: variant.sku,
      label: variant.label,
      sizeValue: variant.sizeValue,
      sizeUnit: variant.sizeUnit,
      price: variant.price,
      inStock: variant.availableQty > 0,
      batch: batchByVariant.get(variant._id.toString()),
    })),
  };
}

// ── Options for the filter panel ──────────────────────

export async function getPublicFilterOptions(): Promise<{
  sizes: SizeOption[];
  priceRange: { min: number; max: number } | null;
}> {
  const publishedIds = await Product.distinct("_id", { status: "published" });

  const variantFilter: Record<string, unknown> = {
    product: mongoose.trusted({ $in: publishedIds }),
    status: "active",
  };
  const variants = await Variant.find(variantFilter)
    .select("sizeValue sizeUnit price")
    .sort({ sizeUnit: 1, sizeValue: 1 })
    .lean();

  const seen = new Set<string>();
  const sizes: SizeOption[] = [];
  for (const variant of variants) {
    const value = `${variant.sizeValue}-${variant.sizeUnit}`;
    if (!seen.has(value)) {
      seen.add(value);
      sizes.push({ value, label: `${variant.sizeValue} ${variant.sizeUnit}` });
    }
  }

  const prices = variants.map((variant) => variant.price);
  const priceRange =
    prices.length > 0
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null;

  return { sizes, priceRange };
}
