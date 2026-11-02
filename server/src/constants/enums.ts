// All allowed values for the app, defined once.
// Source: System Design Release 1, Part 2 (Database).
// Arrays are used for Mongoose validation and dropdowns; types are used in code.

// ── Catalog ───────────────────────────────────────────
export const CATEGORY_STATUSES = ['active', 'hidden', 'archived'] as const;
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

export const PRODUCT_STATUSES = ['draft', 'published', 'unpublished', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const VARIANT_STATUSES = ['active', 'unavailable', 'archived'] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export const SIZE_UNITS = ['g', 'kg', 'ml', 'l', 'pcs'] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

export const CERTIFICATE_STATUSES = ['active', 'expired', 'archived'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

// ── Inventory ─────────────────────────────────────────
export const BATCH_STATUSES = ['active', 'depleted', 'written_off'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const STOCK_MOVEMENT_TYPES = [
  'received',
  'reserved',
  'released',
  'packed',
  'unpacked',
  'adjusted_in',
  'adjusted_out',
  'damaged',
  'expired',
  'return_restocked',
  'return_written_off',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
// ── Customers ─────────────────────────────────────────
export const VERIFIED_VIA = ['confirmation_call'] as const;
export type VerifiedVia = (typeof VERIFIED_VIA)[number];

// ── Orders ────────────────────────────────────────────
export const ORDER_STATUSES = [
  'new',
  'contact_attempt_1',
  'contact_attempt_2',
  'contact_attempt_3',
  'confirmed',
  'packing',
  'shipped',
  'delivered',
  'delivery_failed',
  'returned',
  'cancelled',
  'refund_pending',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CONTACT_OUTCOMES = [
  'no_answer',
  'busy',
  'switched_off',
  'wrong_number',
  'confirmed',
  'customer_cancelled',
] as const;
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];

export const CANCELLATION_SOURCES = ['status_page', 'whatsapp', 'admin'] as const;
export type CancellationSource = (typeof CANCELLATION_SOURCES)[number];

export const PAYMENT_METHODS = ['cod'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'collected',
  'refused',
  'uncollected',
  'refunded',
  'partially_refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const COURIERS = ['tcs', 'postex', 'leopards'] as const;
export type Courier = (typeof COURIERS)[number];

export const RETURN_DECISIONS = ['restock', 'write_off'] as const;
export type ReturnDecision = (typeof RETURN_DECISIONS)[number];

// ── Refunds ───────────────────────────────────────────
export const REFUND_REASONS = ['damaged', 'incorrect'] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const REFUND_STATUSES = ['requested', 'approved', 'rejected', 'paid'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_STOCK_ACTIONS = ['none', 'written_off'] as const;
export type RefundStockAction = (typeof REFUND_STOCK_ACTIONS)[number];

// ── Content and notifications ─────────────────────────
export const PAGE_SLUGS = ['refund', 'privacy', 'delivery', 'terms', 'review-rules'] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export const PAGE_STATUSES = ['placeholder', 'needs_review', 'approved'] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ['email', 'whatsapp_link', 'whatsapp_api'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['queued', 'sent', 'failed', 'prepared'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_TEMPLATES = [
  'orderPlaced',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'deliveryFailed',
] as const;
export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number];

// ── Carts and analytics ───────────────────────────────
export const CART_STATUSES = ['active', 'converted', 'abandoned'] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

export const ANALYTICS_EVENT_TYPES = [
  'page_view',
  'product_view',
  'search',
  'add_to_cart',
  'checkout_start',
  'order_completed',
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

// ── Admin ─────────────────────────────────────────────
export const ADMIN_ROLES = ['owner'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

// ── Release 2 ─────────────────────────────────────────
export const REVIEW_STATUSES = ['pending', 'published', 'hidden', 'removed'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const PROMOTION_TYPES = ['code', 'product', 'category', 'welcome', 'seasonal'] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const PROMOTION_AUDIENCES = ['all', 'members'] as const;
export type PromotionAudience = (typeof PROMOTION_AUDIENCES)[number];

export const DISCOUNT_TYPES = ['percent', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const PROMOTION_STATUSES = ['active', 'paused', 'ended'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

// ── Delivery ──────────────────────────────────────────
export const PROVINCES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Gilgit-Baltistan',
  'Azad Jammu and Kashmir',
] as const;
export type Province = (typeof PROVINCES)[number];

export const CITY_SOURCES = ['seed', 'admin', 'customer'] as const;
export type CitySource = (typeof CITY_SOURCES)[number];
