import type { Request, Response } from 'express';
import { track } from './analytics.service.js';
import type { TrackEventInput } from './analytics.validation.js';

// The website calls this when a page opens and when checkout starts. Always answers 204
// (no content) at once: the event is saved in the background.
export function trackEvent(req: Request, res: Response): void {
  const input = req.body as TrackEventInput;
  track(req, {
    type: input.type,
    path: input.path,
    source: { referrer: input.referrer, utmSource: input.utmSource, utmMedium: input.utmMedium, utmCampaign: input.utmCampaign },
  });
  res.status(204).end();
}