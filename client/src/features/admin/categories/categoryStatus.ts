import type { CategoryStatus } from '../../../api/catalog';
import type { BadgeTone } from '../../../components/ui/Badge';

export const CATEGORY_STATUS_LABELS: Record<CategoryStatus, string> = {
  active: 'Shown',
  hidden: 'Hidden',
  archived: 'Archived',
};

export const CATEGORY_STATUS_TONES: Record<CategoryStatus, BadgeTone> = {
  active: 'success',
  hidden: 'warning',
  archived: 'neutral',
};

export const CATEGORY_STATUS_HELP: Record<CategoryStatus, string> = {
  active: 'In the store menu.',
  hidden: 'Not in the store menu.',
  archived: 'Retired. New products cannot use it.',
};