import type { Request, Response } from 'express';
import * as orderPublicService from './orderPublic.service.js';
import type { LookupOrderInput, RequestCancellationInput } from './orderPublic.validation.js';

export async function lookup(req: Request, res: Response): Promise<void> {
  const order = await orderPublicService.lookupOrder(req.body as LookupOrderInput);
  res.json({ success: true, order });
}

export async function requestCancellation(req: Request, res: Response): Promise<void> {
  const { message, ...order } = await orderPublicService.requestCancellation(req.body as RequestCancellationInput);
  res.json({ success: true, message, order });
}