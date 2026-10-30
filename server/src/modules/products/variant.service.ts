import mongoose, { isValidObjectId } from 'mongoose';
import Variant, { type VariantDocument } from '../../models/Variant.js';
import type { VariantStatus } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { diffChanges } from '../../utils/diffChanges.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { findProductOrThrow, refreshProductSummary } from './product.service.js';
import type { CreateVariantInput, UpdateVariantInput } from './variant.validation.js';

// ── Helpers ───────────────────────────────────────────

async function findVariantOrThrow(productId: string, variantId: string): Promise<VariantDocument> {
  if (!isValidObjectId(productId) || !isValidObjectId(variantId)) {
    throw new AppError('Size not found', 404);
  }
  const variant = await Variant.findOne({ _id: variantId, product: productId });
  if (!variant) {
    throw new AppError('Size not found', 404);
  }
  return variant;
}

async function assertSkuAvailable(sku: string, excludeId?: string): Promise<void> {
  const existing = await Variant.findOne({ sku });
  if (existing && existing.id !== excludeId) {
    throw new AppError(`The SKU "${sku}" is already used by another size`, 409);
  }
}

// ── Admin ─────────────────────────────────────────────

export async function listVariants(productId: string): Promise<VariantDocument[]> {
  const product = await findProductOrThrow(productId);
  return Variant.find({ product: product._id }).sort({ sortOrder: 1, sizeValue: 1 });
}

export async function createVariant(
  productId: string,
  input: CreateVariantInput,
  actor: ActorContext
): Promise<VariantDocument> {
  const product = await findProductOrThrow(productId);

  if (product.status === 'archived') {
    throw new AppError('Cannot add sizes to an archived product', 400);
  }

  await assertSkuAvailable(input.sku);

  const variant = await Variant.create({ ...input, product: product._id });
  await refreshProductSummary(product._id);

  await recordAudit({
    admin: actor.adminId,
    action: 'variant.create',
    entityType: 'Variant',
    entityId: variant.id,
    after: { product: product.id, sku: variant.sku, label: variant.label, price: variant.price },
    ip: actor.ip,
  });

  return variant;
}

export async function updateVariant(
  productId: string,
  variantId: string,
  input: UpdateVariantInput,
  actor: ActorContext
): Promise<VariantDocument> {
  const variant = await findVariantOrThrow(productId, variantId);

  if (variant.status === 'archived') {
    throw new AppError('Archived sizes cannot be edited', 400);
  }

  const { before, after, hasChanges } = diffChanges(variant.toObject(), input);
  if (!hasChanges) {
    return variant;
  }

  if (after.sku !== undefined) {
    await assertSkuAvailable(input.sku as string, variant.id);
  }

  variant.set(after);
  await variant.save();

  const priceChanged = after.price !== undefined;
  if (priceChanged) {
    await refreshProductSummary(variant.product);
  }

  await recordAudit({
    admin: actor.adminId,
    action: priceChanged ? 'variant.price_update' : 'variant.update',
    entityType: 'Variant',
    entityId: variant.id,
    before,
    after,
    ip: actor.ip,
  });

  return variant;
}

export async function changeVariantStatus(
  productId: string,
  variantId: string,
  status: VariantStatus,
  actor: ActorContext
): Promise<VariantDocument> {
  const variant = await findVariantOrThrow(productId, variantId);

  if (variant.status === status) {
    return variant;
  }

  // A published product must always keep at least one size on sale.
  if (variant.status === 'active') {
    const product = await findProductOrThrow(productId);
    if (product.status === 'published') {
      const otherActive = await Variant.countDocuments({
        product: product._id,
        status: 'active',
        _id: mongoose.trusted({ $ne: variant._id }),
      });
      if (otherActive === 0) {
        throw new AppError(
          'This is the only active size of a published product. Unpublish the product first, or add another size.',
          400
        );
      }
    }
  }

  const previousStatus = variant.status;
  variant.status = status;
  await variant.save();
  await refreshProductSummary(variant.product);

  await recordAudit({
    admin: actor.adminId,
    action: 'variant.status_change',
    entityType: 'Variant',
    entityId: variant.id,
    before: { status: previousStatus },
    after: { status },
    ip: actor.ip,
  });

  return variant;
}