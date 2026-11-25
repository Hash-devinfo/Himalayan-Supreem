import type { Request, Response } from 'express';
import { actorFrom } from '../../middleware/requireAdmin.js';
import * as logoService from './logo.service.js';

// multipart/form-data: "image" (the logo file)
export async function upload(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, ...(await logoService.setLogo(req.file, actorFrom(req))) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await logoService.removeLogo(actorFrom(req))) });
}

// Public: GET /api/store
export async function storeInfo(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, store: await logoService.publicStoreInfo() });
}