import type { Request, Response } from 'express';
import * as zoneService from './zone.service.js';
import * as cityService from './city.service.js';
import { actorFrom } from '../../middleware/requireAdmin.js';
import { parseOrThrow } from '../../middleware/validate.js';
import {
  listCitiesQuerySchema,
  type AssignZoneInput,
  type CreateCityInput,
  type CreateZoneInput,
  type UpdateCityInput,
  type UpdateZoneInput,
    type QuoteInput,
}  from './delivery.validation.js';
import * as quoteService from './quote.service.js';


type IdParams = { id: string };

// ── Zones ─────────────────────────────────────────────

export async function listZones(_req: Request, res: Response): Promise<void> {
  const result = await zoneService.listZones();
  res.json({ success: true, ...result });
}

export async function createZone(req: Request, res: Response): Promise<void> {
  const zone = await zoneService.createZone(req.body as CreateZoneInput, actorFrom(req));
  res.status(201).json({ success: true, zone });
}

export async function updateZone(req: Request<IdParams>, res: Response): Promise<void> {
  const zone = await zoneService.updateZone(req.params.id, req.body as UpdateZoneInput, actorFrom(req));
  res.json({ success: true, zone });
}

export async function makeDefaultZone(req: Request<IdParams>, res: Response): Promise<void> {
  const zone = await zoneService.makeDefaultZone(req.params.id, actorFrom(req));
  res.json({ success: true, zone });
}

// ── Cities ────────────────────────────────────────────

export async function listCities(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listCitiesQuerySchema, req.query);
  const result = await cityService.listCities(query);
  res.json({ success: true, ...result });
}

export async function createCity(req: Request, res: Response): Promise<void> {
  const city = await cityService.createCity(req.body as CreateCityInput, actorFrom(req));
  res.status(201).json({ success: true, city });
}

export async function updateCity(req: Request<IdParams>, res: Response): Promise<void> {
  const city = await cityService.updateCity(req.params.id, req.body as UpdateCityInput, actorFrom(req));
  res.json({ success: true, city });
}

export async function assignZone(req: Request, res: Response): Promise<void> {
  const result = await cityService.assignZone(req.body as AssignZoneInput, actorFrom(req));
  res.json({ success: true, ...result });
}



// ── Public ────────────────────────────────────────────

export async function publicCities(_req: Request, res: Response): Promise<void> {
  const cities = await quoteService.listPublicCities();
  // The list changes rarely: let browsers keep it for 10 minutes
  res.set('Cache-Control', 'public, max-age=600');
  res.json({ success: true, cities });
}

export async function quote(req: Request, res: Response): Promise<void> {
  const result = await quoteService.quoteForItems(req.body as QuoteInput);
  res.json({ success: true, quote: result });
}