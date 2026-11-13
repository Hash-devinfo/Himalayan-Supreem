import type { Request, Response } from 'express';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import * as customerService from './customer.service.js';
import { listCustomersQuerySchema, phoneParamSchema, type BlockCustomerInput, type UnblockCustomerInput } from './customer.validation.js';

type PhoneParams = { phone: string };

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listCustomersQuerySchema, req.query);
  res.json({ success: true, ...(await customerService.listCustomers(query)) });
}

export async function get(req: Request<PhoneParams>, res: Response): Promise<void> {
  const phone = parseOrThrow(phoneParamSchema, req.params.phone);
  res.json({ success: true, ...(await customerService.getCustomer(phone)) });
}

export async function block(req: Request<PhoneParams>, res: Response): Promise<void> {
  const phone = parseOrThrow(phoneParamSchema, req.params.phone);
  res.json({ success: true, ...(await customerService.blockCustomer(phone, req.body as BlockCustomerInput, actorFrom(req))) });
}

export async function unblock(req: Request<PhoneParams>, res: Response): Promise<void> {
  const phone = parseOrThrow(phoneParamSchema, req.params.phone);
  res.json({ success: true, ...(await customerService.unblockCustomer(phone, req.body as UnblockCustomerInput, actorFrom(req))) });
}