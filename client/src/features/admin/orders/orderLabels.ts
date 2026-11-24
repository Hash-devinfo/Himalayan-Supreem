import type { CancellationSource, ContactOutcome, Courier, OrderChannel, PaymentStatus } from '../../../api/orders';

export const CONTACT_OUTCOME_LABELS: Record<ContactOutcome, string> = {
  no_answer: 'No answer',
  busy: 'Busy',
  switched_off: 'Phone switched off',
  wrong_number: 'Wrong number',
  confirmed: 'Confirmed',
  customer_cancelled: 'Customer cancelled',
};

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  website: 'Website',
  whatsapp: 'WhatsApp order',
  phone: 'Phone order',
  other: 'Other',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Not collected yet',
  collected: 'Collected',
  refused: 'Refused at the door',
  uncollected: 'Not collected',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
};

export const COURIER_LABELS: Record<Courier, string> = {
  tcs: 'TCS',
  postex: 'PostEx',
  leopards: 'Leopards',
};

export const FAILURE_REASON_LABELS: Record<string, string> = {
  refused: 'Customer refused the parcel',
  uncollected: 'Not collected',
  address_issue: 'Address problem',
  other: 'Other',
};

export const CANCELLATION_SOURCE_LABELS: Record<CancellationSource, string> = {
  status_page: 'the order status page',
  whatsapp: 'WhatsApp',
  admin: 'you',
};