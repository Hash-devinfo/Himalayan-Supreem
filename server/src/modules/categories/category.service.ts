import { isValidObjectId } from 'mongoose';
import Category, { type CategoryDocument } from '../../models/Category.js';
import type { CategoryStatus } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { slugify } from '../../utils/slugify.js';
import { diffChanges } from '../../utils/diffChanges.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.validation.js';

const PUBLIC_FIELDS = 'name slug description image sortOrder';

// Case-insensitive comparison, so "Dry Fruits" and "dry fruits" count as the same name.
const CASE_INSENSITIVE = { locale: 'en', strength: 2 } as const;

// ── Helpers ───────────────────────────────────────────

async function findCategoryOrThrow(id: string): Promise<CategoryDocument> {
  if (!isValidObjectId(id)) {
    throw new AppError('Category not found', 404);
  }
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }
  return category;
}

async function assertNameAvailable(name: string, excludeId?: string): Promise<void> {
  const existing = await Category.findOne({ name }).collation(CASE_INSENSITIVE);
  if (existing && existing.id !== excludeId) {
    throw new AppError(`A category named "${existing.name}" already exists`, 409);
  }
}

async function assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
  const existing = await Category.findOne({ slug });
  if (existing && existing.id !== excludeId) {
    throw new AppError(`The URL slug "${slug}" is already used by "${existing.name}"`, 409);
  }
}

// ── Public (customers) ────────────────────────────────

export async function listPublicCategories(): Promise<CategoryDocument[]> {
  return Category.find({ status: 'active' }).select(PUBLIC_FIELDS).sort({ sortOrder: 1, name: 1 });
}

export async function getPublicCategoryBySlug(slug: string): Promise<CategoryDocument> {
  const category = await Category.findOne({ slug, status: 'active' }).select(PUBLIC_FIELDS);
  if (!category) {
    throw new AppError('Category not found', 404);
  }
  return category;
}

// ── Admin ─────────────────────────────────────────────

export async function listAdminCategories(status?: CategoryStatus): Promise<CategoryDocument[]> {
  const filter = status ? { status } : {};
  return Category.find(filter).sort({ sortOrder: 1, name: 1 });
}

export async function getCategoryById(id: string): Promise<CategoryDocument> {
  return findCategoryOrThrow(id);
}

export async function createCategory(
  input: CreateCategoryInput,
  actor: ActorContext
): Promise<CategoryDocument> {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) {
    throw new AppError('Could not create a URL slug from this name. Please provide a slug.', 400);
  }

  await assertNameAvailable(input.name);
  await assertSlugAvailable(slug);

  const category = await Category.create({ ...input, slug });

  await recordAudit({
    admin: actor.adminId,
    action: 'category.create',
    entityType: 'Category',
    entityId: category.id,
    after: { name: category.name, slug: category.slug, status: category.status },
    ip: actor.ip,
  });

  return category;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  actor: ActorContext
): Promise<CategoryDocument> {
  const category = await findCategoryOrThrow(id);

  const { before, after, hasChanges } = diffChanges(category.toObject(), input);
  if (!hasChanges) {
    return category;
  }

  if (after.name !== undefined) {
    await assertNameAvailable(input.name as string, category.id);
  }
  if (after.slug !== undefined) {
    await assertSlugAvailable(input.slug as string, category.id);
  }

  category.set(after);
  await category.save();

  await recordAudit({
    admin: actor.adminId,
    action: 'category.update',
    entityType: 'Category',
    entityId: category.id,
    before,
    after,
    ip: actor.ip,
  });

  return category;
}

export async function changeCategoryStatus(
  id: string,
  status: CategoryStatus,
  actor: ActorContext
): Promise<CategoryDocument> {
  const category = await findCategoryOrThrow(id);

  if (category.status === status) {
    return category;
  }

  const previousStatus = category.status;
  category.status = status;
  await category.save();

  await recordAudit({
    admin: actor.adminId,
    action: 'category.status_change',
    entityType: 'Category',
    entityId: category.id,
    before: { status: previousStatus },
    after: { status },
    ip: actor.ip,
  });

  return category;
}