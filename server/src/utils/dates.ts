// Pakistan Standard Time (UTC+5, no daylight saving).
// Dates are stored in UTC; calendar days ("today", expiry dates) follow Pakistan time.

export const PKT_TIME_ZONE = "Asia/Karachi";
const PKT_OFFSET = "+05:00";
const DAY_MS = 24 * 60 * 60 * 1000;

// "2027-03-01" -> the moment that day starts in Pakistan (2027-02-28T19:00:00Z)
export function pktDateToUtc(dateText: string): Date {
  const date = new Date(`${dateText}T00:00:00${PKT_OFFSET}`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateText}`);
  }
  return date;
}

// Any moment -> its calendar date in Pakistan, as "YYYY-MM-DD"
export function formatPktDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PKT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// The moment today started in Pakistan
export function startOfTodayPkt(now: Date = new Date()): Date {
  return pktDateToUtc(formatPktDate(now));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// Whole days from the start of today (Pakistan) until a date. 0 = today, negative = past.
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.round((date.getTime() - startOfTodayPkt(now).getTime()) / DAY_MS);
}
