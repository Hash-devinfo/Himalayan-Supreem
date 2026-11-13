import { inventoryRules } from '../settings/inventoryRules.js';
import { addDays } from '../../utils/dates.js';

// The one place the "when does stock stop selling" rule lives.
//
// A batch can be sold only while its expiry date is more than
// sellByCutoffDays days away (Settings, default 7). Expiry dates are stored as the
// start of that day in Pakistan, so a batch expiring on 10 Dec stops selling
// at 00:00 PKT on 3 Dec (it sells until the end of 2 Dec).

// Batches must expire after this moment to be sellable right now.
export function sellableExpiryCutoff(now: Date = new Date()): Date {
  return addDays(now, inventoryRules().sellByCutoffDays);
}

// True once a batch has reached its stop-selling date (or has expired).
export function isPastSellCutoff(expiryDate: Date, now: Date = new Date()): boolean {
  return expiryDate <= sellableExpiryCutoff(now);
}

// The day a batch stops selling.
export function stopSellingDate(expiryDate: Date): Date {
  return addDays(expiryDate, -inventoryRules().sellByCutoffDays);
}