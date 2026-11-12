import type { Request, Response } from 'express';
import { parseOrThrow } from '../../middleware/validate.js';
import { salesQuerySchema } from './report.validation.js';
import * as salesService from './sales.service.js';

export async function sales(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(salesQuerySchema, req.query);
  res.json({ success: true, ...(await salesService.salesReport(query)) });
}