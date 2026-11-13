import type { Request } from 'express';
import type { Types } from 'mongoose';
import AnalyticsEvent from '../../models/AnalyticsEvent.js';
import type { AnalyticsEventType } from '../../constants/enums.js';
import { ANALYTICS_RETENTION_DAYS } from '../../constants/analytics.js';
import { addDays } from '../../utils/dates.js';

// Search engines and link previews are not customers: their visits are not counted
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|lighthouse|headless/i;

export interface TrackInput {
  type: AnalyticsEventType;
  product?: Types.ObjectId | string;
  variant?: Types.ObjectId | string;
  orderNumber?: string;
  searchQuery?: string;
  resultCount?: number;
  path?: string;
  source?: { referrer?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string };
}

// Records one event. Fire-and-forget: analytics must NEVER slow down or break a customer's request.
export function track(req: Request, input: TrackInput): void {
  if (BOT.test(req.get('user-agent') ?? '')) return;

  AnalyticsEvent.create({
    ...input,
    searchQuery: input.searchQuery ? cleanSearch(input.searchQuery) : undefined,
    path: input.path ? cleanPath(input.path) : undefined,
    source: input.source ? cleanSource(input.source) : undefined,
    visitorId: req.visitorId,
    expiresAt: addDays(new Date(), ANALYTICS_RETENTION_DAYS),
  }).catch((error: unknown) => {
    console.error('[analytics] Event not saved:', input.type, error instanceof Error ? error.message : error);
  });
}

// Lower case, single spaces, and any long number (a phone someone typed) replaced by #
function cleanSearch(text: string): string {
  return text.toLowerCase().replace(/\d{7,}/g, '#').replace(/\s+/g, ' ').trim().slice(0, 100);
}

// The path only: "/products/almonds?phone=0300..." -> "/products/almonds"
function cleanPath(path: string): string {
  return path.split(/[?#]/)[0]!.slice(0, 200);
}

// Only the referrer's website name: "https://www.facebook.com/some/page?x=1" -> "facebook.com"
function cleanSource(source: NonNullable<TrackInput['source']>) {
  let referrer: string | undefined;
  if (source.referrer) {
    try {
      referrer = new URL(source.referrer).hostname.replace(/^www\./, '').slice(0, 200);
    } catch {
      referrer = undefined;
    }
  }
  const tidy = (v?: string) => (v ? v.trim().toLowerCase().slice(0, 100) || undefined : undefined);
  return { referrer, utmSource: tidy(source.utmSource), utmMedium: tidy(source.utmMedium), utmCampaign: tidy(source.utmCampaign) };
}