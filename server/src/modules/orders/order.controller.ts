import type { Request, Response } from 'express';
import * as orderService from './order.service.js';
import * as packingService from './packing.service.js';
import * as fulfillmentService from './fulfillment.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import {
  listOrdersQuerySchema,
  type CancelOrderInput,
  type DeclineCancellationInput,
  type LogCallInput,
  type RecordCancellationRequestInput,
  type UpdateNotesInput,
} from './order.validation.js';
import type { PackOrderInput, UnpackOrderInput } from './packing.validation.js';
import type { DeliverOrderInput, FailDeliveryInput, RemitInput, ReturnOrderInput, ShipOrderInput } from './fulfillment.validation.js';



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



// ── Packing ───────────────────────────────────────────

export async function packingPlan(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await packingService.getPackingPlan(req.params.id)) });
}

export async function pack(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await packingService.packOrder(req.params.id, (req.body ?? {}) as PackOrderInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function unpack(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await packingService.unpackOrder(req.params.id, req.body as UnpackOrderInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function packingSlip(req: Request<IdParams>, res: Response): Promise<void> {
  res.json({ success: true, slip: await packingService.getPackingSlip(req.params.id) });
}




// ── Delivery ──────────────────────────────────────────

export async function ship(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await fulfillmentService.shipOrder(req.params.id, req.body as ShipOrderInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function deliver(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await fulfillmentService.deliverOrder(req.params.id, (req.body ?? {}) as DeliverOrderInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function failDelivery(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await fulfillmentService.failDelivery(req.params.id, req.body as FailDeliveryInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function returnOrder(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await fulfillmentService.returnOrder(req.params.id, req.body as ReturnOrderInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function remit(req: Request, res: Response): Promise<void> {
  const result = await fulfillmentService.markRemitted(req.body as RemitInput, actorFrom(req));
  res.json({ success: true, ...result });
}


// ── Cancellation requests ─────────────────────────────

export async function recordCancellationRequest(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await orderService.recordCancellationRequest(req.params.id, req.body as RecordCancellationRequestInput, actorFrom(req));
  res.json({ success: true, ...result });
}

export async function declineCancellationRequest(req: Request<IdParams>, res: Response): Promise<void> {
  const result = await orderService.declineCancellationRequest(req.params.id, req.body as DeclineCancellationInput, actorFrom(req));
  res.json({ success: true, ...result });
}