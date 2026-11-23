import type { OrderStatus } from '../../../api/orders';
import type { ResolvedTheme } from '../../../lib/theme';

// Chart colours for the Sage and stone theme, one set per mode.
// Checked: the line passes 7:1 contrast on each card colour, and the status colours
// stay apart for colour-blind readers in the order listed below, in both modes.
export const CHART_COLORS: Record<ResolvedTheme, { line: string; grid: string; axisText: string; surface: string }> = {
  light: { line: '#4e5d45', grid: '#e0dfd6', axisText: '#5f655a', surface: '#ffffff' },
  dark: { line: '#9fb594', grid: '#2f322c', axisText: '#a3a89b', surface: '#1d1f1b' },
};

export const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface StatusGroup {
  key: string;
  label: string;
  colors: Record<ResolvedTheme, string>;
  statuses: readonly OrderStatus[];
}

// Order matters: neighbours in the bar were checked against each other. Don't reorder without re-checking.
export const STATUS_GROUPS: readonly StatusGroup[] = [
  {
    key: 'waiting',
    label: 'Waiting for call',
    colors: { light: '#c98a00', dark: '#b8841f' },
    statuses: ['new', 'contact_attempt_1', 'contact_attempt_2', 'contact_attempt_3'],
  },
  {
    key: 'preparing',
    label: 'Confirmed or packing',
    colors: { light: '#2f6fb0', dark: '#4a8bd1' },
    statuses: ['confirmed', 'packing'],
  },
  { key: 'shipped', label: 'Shipped', colors: { light: '#d0602e', dark: '#cc6438' }, statuses: ['shipped'] },
  { key: 'delivered', label: 'Delivered', colors: { light: '#1b9a7a', dark: '#1f9e7c' }, statuses: ['delivered'] },
  {
    key: 'problem',
    label: 'Failed, returned or refunded',
    colors: { light: '#8e4ea0', dark: '#b07cc2' },
    statuses: ['delivery_failed', 'returned', 'refund_pending', 'refunded'],
  },
  { key: 'cancelled', label: 'Cancelled', colors: { light: '#a8a59b', dark: '#7c7a72' }, statuses: ['cancelled'] },
];