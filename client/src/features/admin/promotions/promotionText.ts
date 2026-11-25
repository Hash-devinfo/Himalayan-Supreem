import { ApiError } from '../../../api/client';
import type { Promotion, PromotionType } from '../../../api/promotions';
import { formatIsoDay, formatRs } from '../../../lib/format';

export const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');

export const TYPE_LABELS: Record<PromotionType, string> = {
  code: 'Discount code',
  product: 'Product sale',
  category: 'Category sale',
  seasonal: 'Seasonal offer',
  welcome: 'Welcome discount',
};

export const TYPE_HELP: Record<Exclude<PromotionType, 'welcome'>, string> = {
  code: 'Customers type a code in the cart, e.g. EID10',
  product: 'Chosen products are cheaper automatically',
  category: 'Every product in chosen categories is cheaper automatically',
  seasonal: 'A sale with an end date, applied automatically',
};

// "10% off", "Rs 200 off", "15% off, up to Rs 500"
export function discountText(p: Pick<Promotion, 'discountType' | 'value' | 'maxDiscount'>): string {
  const base = p.discountType === 'percent' ? `${p.value}% off` : `${formatRs(p.value)} off`;
  return p.maxDiscount ? `${base}, up to ${formatRs(p.maxDiscount)}` : base;
}

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function stateTone(p: Pick<Promotion, 'live' | 'status' | 'state'>): Tone {
  if (p.live) return 'success';
  if (p.status === 'paused') return 'warning';
  if (p.state.startsWith('Starts')) return 'info';
  return 'neutral';
}

// The server says "Starts 2026-12-01"; show "Starts 1 Dec 2026"
export function stateLabel(state: string): string {
  const match = /^Starts (\d{4}-\d{2}-\d{2})$/.exec(state);
  return match?.[1] ? `Starts ${formatIsoDay(match[1])}` : state;
}