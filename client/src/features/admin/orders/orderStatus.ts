import type { BadgeTone } from '../../../components/ui/Badge';
import { ORDER_STATUSES, type OrderFlag, type OrderStatus } from '../../../api/orders';

// Same wording as server/src/modules/orders/orderStatus.ts
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New',
  contact_attempt_1: 'Contact attempt 1',
  contact_attempt_2: 'Contact attempt 2',
  contact_attempt_3: 'Contact attempt 3',
  confirmed: 'Confirmed',
  packing: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  delivery_failed: 'Delivery failed',
  returned: 'Returned',
  cancelled: 'Cancelled',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
};

// Shorter names for the filter chips, in the order an order moves through
export const STATUS_CHIPS: { status: OrderStatus; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'contact_attempt_1', label: 'Attempt 1' },
  { status: 'contact_attempt_2', label: 'Attempt 2' },
  { status: 'contact_attempt_3', label: 'Attempt 3' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'packing', label: 'Packing' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivery_failed', label: 'Delivery failed' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'refund_pending', label: 'Refund pending' },
  { status: 'refunded', label: 'Refunded' },
  { status: 'returned', label: 'Returned' },
  { status: 'cancelled', label: 'Cancelled' },
];

export const ORDER_FLAG_LABELS: Record<OrderFlag, string> = {
  cancellationRequested: 'Cancellation requested',
  stockShortfall: 'Not enough stock',
  unlistedCity: 'City not in delivery list',
};

export function parseOrderStatus(value: string | null): OrderStatus | undefined {
  return ORDER_STATUSES.find((status) => status === value);
}

export function parseOrderFlag(value: string | null): OrderFlag | undefined {
  return (Object.keys(ORDER_FLAG_LABELS) as OrderFlag[]).find((flag) => flag === value);
}

// Colour of each order status badge
export function orderStatusTone(status: OrderStatus): BadgeTone {
  switch (status) {
    case 'new':
    case 'contact_attempt_1':
    case 'contact_attempt_2':
    case 'contact_attempt_3':
    case 'refund_pending':
      return 'warning';
    case 'confirmed':
    case 'packing':
      return 'info';
    case 'delivered':
      return 'success';
    case 'delivery_failed':
    case 'returned':
      return 'danger';
    default:
      return 'neutral'; // shipped, cancelled, refunded
  }
}