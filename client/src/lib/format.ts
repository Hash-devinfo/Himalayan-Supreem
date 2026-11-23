const PKT = 'Asia/Karachi';

const rupees = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 });
const counts = new Intl.NumberFormat('en-PK');

export const formatRs = (amount: number) => `Rs ${rupees.format(amount)}`;
export const formatCount = (value: number) => counts.format(value);

// Today's date in Pakistan as YYYY-MM-DD (the format the server's reports expect)
export function pktDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export const daysAgo = (days: number, from: Date = new Date()) => new Date(from.getTime() - days * 86_400_000);

// "2026-11-23" -> "23 Nov"
export function formatDay(isoDate: string): string {
  return new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

// "Monday, 23 November"
export function formatToday(): string {
  return new Intl.DateTimeFormat('en-PK', { timeZone: PKT, weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(),
  );
}

// "5 minutes ago", "yesterday", "3 days ago", then "12 Oct"
export function timeAgo(isoDateTime: string): string {
  const seconds = Math.round((Date.now() - new Date(isoDateTime).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return rtf.format(-days, 'day');
  return new Intl.DateTimeFormat('en-PK', { timeZone: PKT, day: 'numeric', month: 'short' }).format(
    new Date(isoDateTime),
  );
}