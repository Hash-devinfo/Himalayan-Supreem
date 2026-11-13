// Cart limits. PLACEHOLDER VALUES until the business decides
// (design: Setting maxQtyPerItem and retention.cartDays). They move into Setting later.

// Most units of one size a customer can put in the cart (also limits fake orders holding stock).
export const MAX_QTY_PER_ITEM = 10;

// Most different sizes in one cart.
export const MAX_CART_LINES = 30;

// A cart with no activity for this many days is deleted automatically.
export const CART_RETENTION_DAYS = 30;

// A cart with items and no activity for this many hours counts as "abandoned" in reports.
// PLACEHOLDER. Customers are never contacted about it (requirements 3.2); if they come back, it reopens.
export const ABANDONED_AFTER_HOURS = 24;