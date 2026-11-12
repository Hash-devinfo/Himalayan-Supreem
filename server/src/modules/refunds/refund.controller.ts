import type { Request, Response } from 'express';
import * as refundService from './refund.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { listRefundsQuerySchema, type CreateRefundInput, type PayRefundInput, type RejectRefundInput } from './refund.validation.js';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listRefundsQuerySchema, req.query);
  res.json({ success: true, ...(await refundService.listRefunds(query)) });
}

export async function get(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await refundService.getRefund(req.params.id)) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const result = await refundService.createRefund(req.body as CreateRefundInput, actorFrom(req));
  res.status(201).json({ success: true, ...result });
}

export async function approve(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await refundService.approveRefund(req.params.id, actorFrom(req))) });
}

export async function reject(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await refundService.rejectRefund(req.params.id, req.body as RejectRefundInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function pay(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await refundService.payRefund(req.params.id, req.body as PayRefundInput, actorFrom(req));
  res.json({ success: true, ...result });
}