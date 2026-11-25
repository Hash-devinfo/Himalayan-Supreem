import type { PageStatus } from '../../../api/pages';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const PAGE_STATUS: Record<PageStatus, { label: string; tone: Tone; hint: string }> = {
  placeholder: { label: 'Not written', tone: 'danger', hint: 'Still the placeholder text. Write it before launch.' },
  needs_review: { label: 'Needs review', tone: 'warning', hint: 'Written, but not approved yet. Customers see a "draft" notice.' },
  approved: { label: 'Approved', tone: 'success', hint: 'Final wording. Customers see it without a notice.' },
};