import type { Request, Response } from 'express';
import { actorFrom } from '../../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../../middleware/validate.js';
import * as postexService from './postex.service.js';
import { integrationLogQuerySchema, type CancelBookingInput, type LoadSheetInput, type MatchCityInput, type PostexSettingsInput } from './postex.validation.js';
import * as bookingService from './postexBooking.service.js';

export async function status(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, postex: await postexService.postexStatus() });
}

export async function check(req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await postexService.checkConnection(actorFrom(req))) });
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  res.json({ success: true, postex: await postexService.updatePostexSettings(req.body as PostexSettingsInput, actorFrom(req)) });
}

export async function syncCities(req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await postexService.syncPostexCities(actorFrom(req))) });
}

export async function matchCity(req: Request<{ cityId: string }>, res: Response): Promise<void> {
  res.json({ success: true, ...(await postexService.matchCity(req.params.cityId, req.body as MatchCityInput, actorFrom(req))) });
}

export async function logs(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(integrationLogQuerySchema, req.query);
  res.json({ success: true, ...(await postexService.listIntegrationLogs(query)) });
}


// ── Bookings (20B) ────────────────────────────────────

type OrderParams = { id: string };

function sendPdf(res: Response, file: { pdf: Buffer; filename: string }): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(file.pdf);
}

export async function book(req: Request<OrderParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await bookingService.bookParcel(req.params.id, actorFrom(req))) });
}

export async function cancelBooking(req: Request<OrderParams>, res: Response): Promise<void> {
  res.json({ success: true, ...(await bookingService.cancelBooking(req.params.id, req.body as CancelBookingInput, actorFrom(req))) });
}

export async function airwayBill(req: Request<OrderParams>, res: Response): Promise<void> {
  sendPdf(res, await bookingService.airwayBill(req.params.id));
}

export async function loadSheet(req: Request, res: Response): Promise<void> {
  sendPdf(res, await bookingService.loadSheet(req.body as LoadSheetInput, actorFrom(req)));
}

export async function citySuggestions(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, ...(await bookingService.citySuggestions()) });
}