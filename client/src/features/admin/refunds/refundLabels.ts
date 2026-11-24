import type { RefundReason, RefundStatus } from '../../../api/refunds';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const REFUND_REASON_LABELS: Record<RefundReason, string> = {
  damaged: 'Damaged',
  incorrect: 'Incorrect product',
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  requested: 'To review',
  approved: 'Approved, to pay',
  rejected: 'Rejected',
  paid: 'Paid',
};

export const REFUND_STATUS_TONES: Record<RefundStatus, Tone> = {
  requested: 'warning',
  approved: 'info',
  rejected: 'neutral',
  paid: 'success',
};

export const OPEN_REFUND: RefundStatus[] = ['requested', 'approved'];

// Same rule as the server: 13+ digits in a row looks like a card or bank account number
export const looksLikeAccountNumber = (text: string) => /\d{13,}/.test(text.replace(/[\s-]/g, ''));