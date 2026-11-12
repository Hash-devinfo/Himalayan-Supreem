import type { Request, Response } from 'express';
import { parseOrThrow } from '../../middleware/validate.js';
import { profitQuerySchema, salesQuerySchema } from './report.validation.js';
import * as salesService from './sales.service.js';
import * as profitService from './profit.service.js';

export async function sales(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(salesQuerySchema, req.query);
  res.json({ success: true, ...(await salesService.salesReport(query)) });
}


export async function profit(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(profitQuerySchema, req.query);
  res.json({ success: true, ...(await profitService.profitReport(query)) });
}