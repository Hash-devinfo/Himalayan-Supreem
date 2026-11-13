import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max).optional();

// What the website itself reports (everything else is recorded by the server)
export const trackEventSchema = z.strictObject({
  type: z.enum(['page_view', 'checkout_start'], 'Type must be page_view or checkout_start'),
  path: text(500),
  referrer: text(500),
  utmSource: text(100),
  utmMedium: text(100),
  utmCampaign: text(100),
});

export type TrackEventInput = z.infer<typeof trackEventSchema>;