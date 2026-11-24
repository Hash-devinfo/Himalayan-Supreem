import type { SizeUnit, VariantStatus } from '../../../api/catalog';
import type { BadgeTone } from '../../../components/ui/Badge';

export const VARIANT_STATUS_LABELS: Record<VariantStatus, string> = {
  active: 'Active',
  unavailable: 'Unavailable',
  archived: 'Archived',
};

export const VARIANT_STATUS_TONES: Record<VariantStatus, BadgeTone> = {
  active: 'success',
  unavailable: 'warning',
  archived: 'neutral',
};

export const VARIANT_STATUS_HELP: Record<VariantStatus, string> = {
  active: 'Customers can buy this size.',
  unavailable: 'Hidden from customers for now. Its stock and batches are kept.',
  archived: 'Retired. It cannot be edited until you restore it.',
};

export const SIZE_UNITS: { value: SizeUnit; label: string }[] = [
  { value: 'g', label: 'g (grams)' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'litres' },
  { value: 'pcs', label: 'pieces' },
];

// The store's default low-stock alert (a server setting, 5 unless changed in Settings)
export const DEFAULT_LOW_STOCK = 5;

export const formatSize = (value: number, unit: SizeUnit) => `${value} ${unit === 'pcs' ? (value === 1 ? 'piece' : 'pieces') : unit}`;