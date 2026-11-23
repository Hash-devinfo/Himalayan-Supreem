import type { BadgeTone } from '../../../components/ui/Badge';
import type { OrderStatus } from '../../../api/orders';

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