import mongoose, { isValidObjectId, type ClientSession, type Types } from 'mongoose';
import Product, { type ProductDocument } from '../../models/Product.js';
import Variant, { type VariantDocument } from '../../models/Variant.js';
import Category from '../../models/Category.js';
import type { ProductStatus } from '../../constants/enums.js';
import AppError, { type ErrorDetail } from '../../utils/AppError.js';
import { slugify } from '../../utils/slugify.js';
import { diffChanges } from '../../utils/diffChanges.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import type {
  CreateProductInput,
  ListProductsAdminQuery,
  UpdateProductInput,
} from './product.validation.js';

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}



// ── Helpers ───────────────────────────────────────────

export async function findProductOrThrow(id: string): Promise<ProductDocument> {
  if (!isValidObjectId(id)) {
    throw new AppError('Product not found', 404);
  }
  const product = await Product.findById(id);
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  return product;
}

async function assertCategoryUsable(categoryId: string, mustBeActive = false): Promise<void> {
  const category = isValidObjectId(categoryId) ? await Category.findById(categoryId) : null;
  if (!category || category.status === 'archived') {
    throw new AppError('Choose an existing category that is not archived', 400, [
      { field: 'category', message: 'Category not found or archived' },
    ]);
  }
  if (mustBeActive && category.status !== 'active') {
    throw new AppError(`A published product can only be moved to an active category`, 400, [
      { field: 'category', message: `"${category.name}" is ${category.status}` },
    ]);
  }
}

async function assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
  const existing = await Product.findOne({ slug });
  if (existing && existing.id !== excludeId) {
    throw new AppError(`The URL slug "${slug}" is already used by "${existing.name}"`, 409);
  }
}

// Checks everything a product needs before customers can see it.
async function assertCanPublish(product: ProductDocument): Promise<void> {
  const problems: ErrorDetail[] = [];

  const category = await Category.findById(product.category);
  if (!category || category.status !== 'active') {
    problems.push({
      field: 'category',
      message: `The category${category ? ` "${category.name}"` : ''} must be active before publishing`,
    });
  }

  const activeVariants = await Variant.countDocuments({ product: product._id, status: 'active' });
  if (activeVariants === 0) {
    problems.push({ field: 'variants', message: 'Add at least one active size before publishing' });
  }

  if (problems.length > 0) {
    throw new AppError('This product is not ready to publish', 400, problems);
  }
}


// Recalculates the cached minPrice, maxPrice and inStock from the product's active variants.
// Pass the session when called inside a transaction.
export async function refreshProductSummary(
  productId: Types.ObjectId | string,
  session?: ClientSession
): Promise<void> {
  const variants = await Variant.find({ product: productId, status: 'active' })
    .select('price availableQty')
    .session(session ?? null);

  if (variants.length === 0) {
    await Product.updateOne(
      { _id: productId },
      { $set: { inStock: false }, $unset: { minPrice: 1, maxPrice: 1 } },
      { session }
    );
    return;
  }

  const prices = variants.map((variant) => variant.price);
  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        inStock: variants.some((variant) => variant.availableQty > 0),
      },
    },
    { session }
  );
}

// ── Admin ─────────────────────────────────────────────

export async function listAdminProducts(
  query: ListProductsAdminQuery
): Promise<PaginatedResult<ProductDocument>> {
  const { status, category, search, page, limit } = query;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (search) filter.$text = mongoose.trusted({ $search: search });

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getAdminProduct(
  id: string
): Promise<{ product: ProductDocument; variants: VariantDocument[] }> {
  const product = await findProductOrThrow(id);
  await product.populate('category', 'name slug status');
  const variants = await Variant.find({ product: product._id }).sort({ sortOrder: 1, sizeValue: 1 });
  return { product, variants };
}

export async function createProduct(
  input: CreateProductInput,
  actor: ActorContext
): Promise<ProductDocument> {
  await assertCategoryUsable(input.category);

  const slug = input.slug ?? slugify(input.name);
  if (!slug) {
    throw new AppError('Could not create a URL slug from this name. Please provide a slug.', 400);
  }
  await assertSlugAvailable(slug);

  const product = await Product.create({ ...input, slug });

  await recordAudit({
    admin: actor.adminId,
    action: 'product.create',
    entityType: 'Product',
    entityId: product.id,
    after: { name: product.name, slug: product.slug, category: input.category, status: product.status },
    ip: actor.ip,
  });

  return product;
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  actor: ActorContext
): Promise<ProductDocument> {
  const product = await findProductOrThrow(id);

  if (product.status === 'archived') {
    throw new AppError('Archived products cannot be edited. Change the status to draft first.', 400);
  }

  const { before, after, hasChanges } = diffChanges(product.toObject(), input);
  if (!hasChanges) {
    return product;
  }

  if (after.category !== undefined) {
    await assertCategoryUsable(input.category as string, product.status === 'published');
  }
  if (after.slug !== undefined) {
    await assertSlugAvailable(input.slug as string, product.id);
  }

  product.set(after);
  await product.save();

  await recordAudit({
    admin: actor.adminId,
    action: 'product.update',
    entityType: 'Product',
    entityId: product.id,
    before,
    after,
    ip: actor.ip,
  });

  return product;
}

export async function changeProductStatus(
  id: string,
  status: ProductStatus,
  actor: ActorContext
): Promise<ProductDocument> {
  const product = await findProductOrThrow(id);

  if (product.status === status) {
    return product;
  }

  if (status === 'published') {
    await assertCanPublish(product);
  }

  const previousStatus = product.status;
  product.status = status;
  await product.save();

  await recordAudit({
    admin: actor.adminId,
    action: 'product.status_change',
    entityType: 'Product',
    entityId: product.id,
    before: { status: previousStatus },
    after: { status },
    ip: actor.ip,
  });

  return product;
}