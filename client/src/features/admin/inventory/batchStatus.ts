import type { BatchView, MovementType } from '../../../api/inventory';
import type { BadgeTone } from '../../../components/ui/Badge';

// Same as the store's expiry warning setting (60 days unless changed in Settings)
export const EXPIRY_WARNING_DAYS = 60;

export function batchBadge(batch: BatchView): { label: string; tone: BadgeTone } {
  if (batch.status === 'written_off') return { label: 'Written off', tone: 'neutral' };
  if (batch.status === 'depleted' || batch.quantityRemaining === 0) return { label: 'Used up', tone: 'neutral' };
  if (batch.isExpired) return { label: 'Expired', tone: 'danger' };
  if (!batch.isSellable) return { label: 'Stopped selling', tone: 'danger' };
  if (batch.daysToExpiry <= EXPIRY_WARNING_DAYS) return { label: 'Expires soon', tone: 'warning' };
  return { label: 'On sale', tone: 'success' };
}

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  received: 'Received',
  reserved: 'Reserved for an order',
  released: 'Released from an order',
  packed: 'Packed',
  unpacked: 'Packing undone',
  adjusted_in: 'Found extra',
  adjusted_out: 'Removed',
  damaged: 'Damaged',
  expired: 'Expired',
  return_restocked: 'Return put back in stock',
  return_written_off: 'Return written off',
};

// Whether a movement adds to (+) or takes from (−) the stock it affects
export const MOVEMENT_IN: ReadonlySet<MovementType> = new Set([
  'received',
  'released',
  'unpacked',
  'adjusted_in',
  'return_restocked',
]);