import type { Request, Response } from 'express';
import * as orderService from './order.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import { listOrdersQuerySchema, type CancelOrderInput, type LogCallInput, type UpdateNotesInput } from './order.validation.js';

type IdParams = { id: string };

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listOrdersQuerySchema, req.query);
  res.json({ success: true, ...(await orderService.listOrders(query)) });
}

export async function get(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await orderService.getOrder(req.params.id)) });
}

export async function logCall(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await orderService.logCall(req.params.id, req.body as LogCallInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function cancel(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await orderService.cancelOrder(req.params.id, req.body as CancelOrderInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function updateNotes(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await orderService.updateNotes(req.params.id, req.body as UpdateNotesInput, actorFrom(req));
  res.json({ success: true, ...result });
}