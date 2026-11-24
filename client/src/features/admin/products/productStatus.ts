import type { ProductStatus } from '../../../api/catalog';
import type { BadgeTone } from '../../../components/ui/Badge';

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  unpublished: 'Unpublished',
  archived: 'Archived',
};

export const PRODUCT_STATUS_TONES: Record<ProductStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  unpublished: 'warning',
  archived: 'neutral',
};

export const PRODUCT_STATUS_HELP: Record<ProductStatus, string> = {
  draft: 'Not visible in the store yet.',
  published: 'Customers can see and buy it.',
  unpublished: 'Hidden from the store. Old orders are not affected.',
  archived: 'Retired. It cannot be edited until you restore it as a draft.',
};

export const PRODUCT_STATUSES: ProductStatus[] = ['draft', 'published', 'unpublished', 'archived'];