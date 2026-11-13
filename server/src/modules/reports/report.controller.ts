import type { Request, Response } from 'express';
import { parseOrThrow } from '../../middleware/validate.js';
import { sendCsv } from '../../utils/csv.js';
import {
    analyticsQuerySchema,
  cancellationsQuerySchema,
  fulfillmentQuerySchema,
  inventoryQuerySchema,
  profitQuerySchema,
  salesQuerySchema,
} from './report.validation.js';
import * as salesService from './sales.service.js';
import * as profitService from './profit.service.js';
import * as stockReportService from './stockReport.service.js';
import * as fulfillmentReportService from './fulfillmentReport.service.js';
import * as cancellationsReportService from './cancellationsReport.service.js';
import * as reportCsv from './reportCsv.js';
import * as analyticsReportService from './analyticsReport.service.js';

// Every report: JSON by default, or a CSV download with &format=csv

export async function sales(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(salesQuerySchema, req.query);
  const report = await salesService.salesReport(query);
  if (query.format === 'csv') return sendCsv(res, reportCsv.salesCsv(report));
  res.json({ success: true, ...report });
}

export async function profit(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(profitQuerySchema, req.query);
  const report = await profitService.profitReport(query);
  if (query.format === 'csv') return sendCsv(res, reportCsv.profitCsv(report));
  res.json({ success: true, ...report });
}

export async function inventory(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(inventoryQuerySchema, req.query);
  const report = await stockReportService.inventoryReport(query);
  if (query.format === 'csv') return sendCsv(res, reportCsv.inventoryCsv(report));
  res.json({ success: true, ...report });
}

export async function fulfillment(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(fulfillmentQuerySchema, req.query);
  const report = await fulfillmentReportService.fulfillmentReport(query);
  if (query.format === 'csv') return sendCsv(res, reportCsv.fulfillmentCsv(report));
  res.json({ success: true, ...report });
}

export async function cancellations(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(cancellationsQuerySchema, req.query);
  const report = await cancellationsReportService.cancellationsReport(query);
  if (query.format === 'csv') return sendCsv(res, reportCsv.cancellationsCsv(report));
  res.json({ success: true, ...report });
}


export async function analytics(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(analyticsQuerySchema, req.query);
  const report = await analyticsReportService.analyticsReport(query);
  if (query.format === 'csv') return sendCsv(res, reportCsv.analyticsCsv(report));
  res.json({ success: true, ...report });
}