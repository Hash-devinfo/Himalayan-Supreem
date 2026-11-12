import type { Request, Response } from 'express';
import { parseOrThrow } from '../../middleware/validate.js';
import { inventoryQuerySchema, profitQuerySchema, salesQuerySchema } from './report.validation.js';
import * as salesService from './sales.service.js';
import * as profitService from './profit.service.js';
import * as stockReportService from './stockReport.service.js';


export async function sales(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(salesQuerySchema, req.query);
  res.json({ success: true, ...(await salesService.salesReport(query)) });
}


export async function profit(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(profitQuerySchema, req.query);
  res.json({ success: true, ...(await profitService.profitReport(query)) });
}


export async function inventory(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(inventoryQuerySchema, req.query);
  res.json({ success: true, ...(await stockReportService.inventoryReport(query)) });
}