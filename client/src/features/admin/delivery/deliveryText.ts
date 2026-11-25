import { ApiError } from '../../../api/client';
import type { DeliveryZone, WeightRule } from '../../../api/delivery';
import { formatRs } from '../../../lib/format';

export const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');

// 500 -> "500 g", 1500 -> "1.5 kg"
export function formatGrams(grams: number): string {
  if (grams < 1000) return `${grams} g`;
  const kg = grams / 1000;
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

// One line that says how a zone charges
export function zoneChargeSummary(zone: Pick<DeliveryZone, 'charge' | 'weightRules'>): string {
  if (zone.weightRules.length === 0) return `${formatRs(zone.charge)} per order`;
  const rules = zone.weightRules;
  const first = rules[0] as WeightRule;
  const last = rules[rules.length - 1] as WeightRule;
  if (rules.length === 1) return `${formatRs(first.charge)} (by weight)`;
  return `${formatRs(first.charge)} – ${formatRs(Math.max(...rules.map((r) => r.charge)))} by weight, up to ${formatGrams(last.upToGrams)}+`;
}