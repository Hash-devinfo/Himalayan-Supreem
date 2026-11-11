import type { ClientSession } from 'mongoose';
import Counter from '../../models/Counter.js';
import { formatPktDate } from '../../utils/dates.js';

// ORD-YYMMDD-NNNN, e.g. ORD-261112-0001. The date is the PAKISTAN date (an order at 00:30 PKT
// belongs to the new day even though the server clock, in UTC, still shows yesterday).
// The sequence restarts at 0001 each day.
export async function nextOrderNumber(prefix: string, session: ClientSession, now: Date = new Date()): Promise<string> {
  const yymmdd = formatPktDate(now).slice(2).replaceAll('-', ''); // "2026-11-12" -> "261112"

  // $inc is atomic: two orders at the same moment can never get the same number.
  // upsert creates the day's counter on its first order.
  const counter = await Counter.findOneAndUpdate(
    { _id: `order-${yymmdd}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session }
  );
  const seq = counter?.seq ?? 1;

  return `${prefix}-${yymmdd}-${String(seq).padStart(4, '0')}`;
}