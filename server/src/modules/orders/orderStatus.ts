import type { OrderStatus } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';

// The ONLY status changes allowed (design Part 3.2). The server enforces these, not just the admin screen.
const ALLOWED: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ['contact_attempt_1', 'confirmed', 'cancelled'],
  contact_attempt_1: ['contact_attempt_2', 'confirmed', 'cancelled'],
  contact_attempt_2: ['contact_attempt_3', 'confirmed', 'cancelled'],
  contact_attempt_3: ['confirmed', 'cancelled'],
  confirmed: ['packing', 'cancelled'],
  packing: ['confirmed', 'shipped'], // packing -> confirmed = undo packing
  shipped: ['delivered', 'delivery_failed'],
  delivery_failed: ['shipped', 'returned'], // shipped again = courier re-attempt
  delivered: ['refund_pending'],
  refund_pending: ['refunded', 'delivered'], // back to delivered = refund rejected
  returned: [],
  cancelled: [],
  refunded: [],
};

// Before packing: stock is only reserved, so the order can still be cancelled
export const CANCELLABLE: readonly OrderStatus[] = ['new', 'contact_attempt_1', 'contact_attempt_2', 'contact_attempt_3', 'confirmed'];

// Waiting for the confirmation call
export const AWAITING_CALL: readonly OrderStatus[] = ['new', 'contact_attempt_1', 'contact_attempt_2', 'contact_attempt_3'];

const LABELS: Record<OrderStatus, string> = {
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

export function statusLabel(status: OrderStatus): string {
  return LABELS[status];
}

export function canChange(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertCanChange(from: OrderStatus, to: OrderStatus): void {
  if (!canChange(from, to)) {
    throw new AppError(`An order that is "${statusLabel(from)}" cannot be changed to "${statusLabel(to)}"`, 409);
  }
}