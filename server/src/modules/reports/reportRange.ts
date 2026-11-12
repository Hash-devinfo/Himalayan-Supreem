import { addDays, formatPktDate, startOfTodayPkt } from '../../utils/dates.js';

export interface ReportRange {
  from: string; // YYYY-MM-DD, Pakistan
  to: string; // inclusive
  start: Date; // UTC moment the first day starts in Pakistan
  end: Date; // UTC moment AFTER the last day ends (use $lt)
}

// Default: the last 30 days including today (Pakistan time, design: reporting time zone PKT)
export function resolveRange(from?: Date, to?: Date): ReportRange {
  const end = addDays(to ?? startOfTodayPkt(), 1);
  const start = from ?? addDays(end, -30);
  return { from: formatPktDate(start), to: formatPktDate(addDays(end, -1)), start, end };
}