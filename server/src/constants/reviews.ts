import type { OrderStatus } from './enums.js';

// Orders the customer received, so they may review the products in them (BR-06).
// Refund pending / refunded orders were delivered too (the refund was for a damaged or wrong item).
export const REVIEWABLE_STATUSES: readonly OrderStatus[] = ['delivered', 'refund_pending', 'refunded'];

// How long the review link sent after delivery keeps working.
// PLACEHOLDER: business decision (the order number + phone way always works).
export const REVIEW_LINK_DAYS = 60;