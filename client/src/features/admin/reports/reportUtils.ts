import type { SalesGroup } from '../../../api/reports';
import { daysAgo, formatCount, formatRs, pktDateString } from '../../../lib/format';

export interface DateRange {
  from: string; // YYYY-MM-DD, Pakistan
  to: string;
}

export const rs = (amount: number) => formatRs(amount);
export const n = (value: number) => formatCount(value);
export const pct = (value: number | null) => (value === null ? '—' : `${value}%`);

export const SALES_GROUPS: { value: SalesGroup; label: string }[] = [
  { value: 'day', label: 'By day' },
  { value: 'product', label: 'By product' },
  { value: 'variant', label: 'By size' },
  { value: 'category', label: 'By category' },
  { value: 'courier', label: 'By courier' },
];

// The first and last day of a month, counting back from today (Pakistan date)
function monthRange(today: string, monthsBack: number): DateRange {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  const last = new Date(Date.UTC(y, m - monthsBack, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: monthsBack === 0 ? today : iso(last) };
}

export function presets(): { label: string; range: DateRange }[] {
  const today = pktDateString();
  return [
    { label: 'Today', range: { from: today, to: today } },
    { label: '7 days', range: { from: pktDateString(daysAgo(6)), to: today } },
    { label: '30 days', range: { from: pktDateString(daysAgo(29)), to: today } },
    { label: 'This month', range: monthRange(today, 0) },
    { label: 'Last month', range: monthRange(today, 1) },
    { label: '90 days', range: { from: pktDateString(daysAgo(89)), to: today } },
  ];
}
