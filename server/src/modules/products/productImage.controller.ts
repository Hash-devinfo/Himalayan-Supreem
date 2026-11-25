import type { Request, Response } from 'express';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { uploadImageFieldsSchema, type RemoveImageInput, type ReorderImagesInput, type UpdateImageInput } from '../media/image.validation.js';
import * as productImageService from './productImage.service.js';

type IdParams = { id: string };

// multipart/form-data: "image" (the file) + "alt" (text)
export async function add(req: Request<IdParams>, res: Response): Promise<void> {
  const { alt } = parseOrThrow(uploadImageFieldsSchema, req.body ?? {});
  const result = await productImageService.addProductImage(req.params.id, req.file, alt, actorFrom(req));
  res.status(201).json({ success: true, ...result });
}

export async function update(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await productImageService.updateProductImage(req.params.id, req.body as UpdateImageInput, actorFrom(req))) });
}

export async function reorder(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await productImageService.reorderProductImages(req.params.id, req.body as ReorderImagesInput, actorFrom(req))) });
}

export async function remove(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await productImageService.removeProductImage(req.params.id, req.body as RemoveImageInput, actorFrom(req))) });
}