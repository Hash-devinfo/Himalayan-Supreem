import type { OrderStatus } from '../../../api/orders';

// Chart colours for the Sage and stone theme. Checked on white: the line passes 7:1 contrast,
// and the status colours stay apart for colour-blind readers in the order listed below.
export const CHART = {
  line: '#4e5d45', // sage
  grid: '#e0dfd6', // line
  axisText: '#5f655a', // muted
  surface: '#ffffff',
} as const;

export const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface StatusGroup {
  key: string;
  label: string;
  color: string;
  statuses: readonly OrderStatus[];
}

// Order matters: neighbours in the bar were checked against each other. Don't reorder without re-checking.
export const STATUS_GROUPS: readonly StatusGroup[] = [
  {
    key: 'waiting',
    label: 'Waiting for call',
    color: '#c98a00',
    statuses: ['new', 'contact_attempt_1', 'contact_attempt_2', 'contact_attempt_3'],
  },
  { key: 'preparing', label: 'Confirmed or packing', color: '#2f6fb0', statuses: ['confirmed', 'packing'] },
  { key: 'shipped', label: 'Shipped', color: '#d0602e', statuses: ['shipped'] },
  { key: 'delivered', label: 'Delivered', color: '#1b9a7a', statuses: ['delivered'] },
  {
    key: 'problem',
    label: 'Failed, returned or refunded',
    color: '#8e4ea0',
    statuses: ['delivery_failed', 'returned', 'refund_pending', 'refunded'],
  },
  { key: 'cancelled', label: 'Cancelled', color: '#a8a59b', statuses: ['cancelled'] },
];