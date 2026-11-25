import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import { deleteImage, uploadImage } from '../../providers/storage/cloudinary.js';
import AppError from '../../utils/AppError.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { assertPhoto } from '../media/imageFile.js';
import type { RemoveImageInput, ReorderImagesInput, UpdateImageInput } from '../media/image.validation.js';
import { findProductOrThrow } from './product.service.js';

// Product photos (requirements 4.1). The first photo is the main one, shown on product cards.
export const MAX_PRODUCT_IMAGES = 8;
export const MAX_PRODUCT_IMAGE_MB = 5;

function imagesView(images: { url: string; thumbUrl?: string; publicId: string; alt: string; width?: number; height?: number }[]) {
  return images.map((i) => ({ publicId: i.publicId, url: i.url, thumbUrl: i.thumbUrl ?? i.url, alt: i.alt, width: i.width, height: i.height }));
}

export async function addProductImage(productId: string, file: Express.Multer.File | undefined, alt: string, actor: ActorContext) {
  const bytes = assertPhoto(file);
  const product = await findProductOrThrow(productId);
  if (product.status === 'archived') throw new AppError('Photos cannot be added to an archived product', 409);
  if (product.images.length >= MAX_PRODUCT_IMAGES) {
    throw new AppError(`A product can have at most ${MAX_PRODUCT_IMAGES} photos. Remove one first.`, 409);
  }

  const stored = await uploadImage(bytes, { folder: `products/${product.id}` });
  const image = { url: stored.url, thumbUrl: stored.thumbUrl, publicId: stored.publicId, alt, width: stored.width, height: stored.height };

  // Added only if there is still room (two uploads at once cannot go over the limit)
  const filter: Record<string, unknown> = { _id: product._id, [`images.${MAX_PRODUCT_IMAGES - 1}`]: mongoose.trusted({ $exists: false }) };
  const updated = await Product.findOneAndUpdate(filter, { $push: { images: image } }, { returnDocument: 'after' });
  if (!updated) {
    await deleteImage(stored.publicId); // do not leave the unused photo in Cloudinary
    throw new AppError(`A product can have at most ${MAX_PRODUCT_IMAGES} photos. Remove one first.`, 409);
  }

  await recordAudit({
    admin: actor.adminId,
    action: 'product.image_add',
    entityType: 'Product',
    entityId: updated.id,
    after: { publicId: stored.publicId, alt, width: stored.width, height: stored.height, bytes: stored.bytes },
    ip: actor.ip,
  });
  return { images: imagesView(updated.images), note: stored.width < 600 ? 'This photo is small (under 600 px wide) and may look blurry on large screens.' : undefined };
}

export async function updateProductImage(productId: string, input: UpdateImageInput, actor: ActorContext) {
  const product = await findProductOrThrow(productId);
  const image = product.images.find((i) => i.publicId === input.publicId);
  if (!image) throw new AppError('Photo not found on this product', 404);
  const before = image.alt;
  image.alt = input.alt;
  await product.save();
  await recordAudit({ admin: actor.adminId, action: 'product.image_update', entityType: 'Product', entityId: product.id, before: { alt: before }, after: { publicId: input.publicId, alt: input.alt }, ip: actor.ip });
  return { images: imagesView(product.images) };
}

// The admin drags photos into a new order; the first one becomes the main photo
export async function reorderProductImages(productId: string, input: ReorderImagesInput, actor: ActorContext) {
  const product = await findProductOrThrow(productId);
  const current = product.images.map((i) => i.publicId);
  const same = input.publicIds.length === current.length && new Set(input.publicIds).size === current.length && input.publicIds.every((id) => current.includes(id));
  if (!same) throw new AppError('Send every photo of this product exactly once, in the new order', 400);

  // Plain copies of each photo (a sub-document spread would lose its fields)
  const byId = new Map(product.toObject().images.map((i) => [i.publicId, i]));
  product.set('images', input.publicIds.map((id) => byId.get(id)));
  await product.save();
  await recordAudit({ admin: actor.adminId, action: 'product.image_reorder', entityType: 'Product', entityId: product.id, before: { order: current }, after: { order: input.publicIds }, ip: actor.ip });
  return { images: imagesView(product.images) };
}

export async function removeProductImage(productId: string, input: RemoveImageInput, actor: ActorContext) {
  const product = await findProductOrThrow(productId);
  const image = product.images.find((i) => i.publicId === input.publicId);
  if (!image) throw new AppError('Photo not found on this product', 404);

  await Product.updateOne({ _id: product._id }, { $pull: { images: { publicId: input.publicId } } });
  const deleted = await deleteImage(input.publicId);
  await recordAudit({ admin: actor.adminId, action: 'product.image_remove', entityType: 'Product', entityId: product.id, before: { publicId: input.publicId, alt: image.alt }, after: { deletedFromStorage: deleted }, ip: actor.ip });

  const fresh = await findProductOrThrow(productId);
  return { images: imagesView(fresh.images) };
}