import type { NotificationTemplate } from '../../constants/enums.js';
import type { OrderDocument } from '../../models/Order.js';
import type { SettingDocument } from '../../models/Setting.js';
import { formatPktDate } from '../../utils/dates.js';
import { formatPkMobile } from '../../utils/phone.js';

// ── What each message is for, and where it can go (design 3.8) ──

export const TEMPLATE_INFO: Record<NotificationTemplate, { label: string; email: boolean; whatsapp: boolean }> = {
  orderPlaced: { label: 'Order placed', email: true, whatsapp: true },
  confirmed: { label: 'Order confirmed', email: true, whatsapp: true },
  shipped: { label: 'Shipped (with courier and tracking)', email: true, whatsapp: true },
  delivered: { label: 'Delivered', email: true, whatsapp: true },
  cancelled: { label: 'Cancelled', email: true, whatsapp: true },
  deliveryFailed: { label: 'Delivery failed', email: false, whatsapp: true },
  missedCall: { label: 'Missed confirmation call', email: false, whatsapp: true },
};

// ── Placeholders the business can use in its wording ──

export const PLACEHOLDERS = {
  storeName: 'Your store name (from Settings)',
  customerName: "Customer's name",
  orderNumber: 'Order number, e.g. ORD-261112-0001',
  orderDate: 'Date the order was placed (Pakistan date)',
  orderTotal: 'Order total, e.g. Rs 2,100',
  itemsList: 'Items, one per line, e.g. "Sample Almonds (250 g) x 2"',
  city: 'Delivery city',
  deliveryEstimate: 'Delivery estimate of the zone, e.g. 3-5 working days',
  courier: 'Courier name (TCS, PostEx, Leopards)',
  trackingNumber: 'Courier tracking number',
  supportWhatsapp: 'Your support WhatsApp number (from Settings)',
} as const;

export type PlaceholderName = keyof typeof PLACEHOLDERS;
export type PlaceholderValues = Record<PlaceholderName, string>;

// {{ orderNumber }} or {{orderNumber}}
const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

// Names written in a template that we do not know (usually a typo): checked when the template is saved
export function unknownPlaceholders(text: string): string[] {
  const unknown = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1] ?? '';
    if (!(name in PLACEHOLDERS)) unknown.add(name);
  }
  return [...unknown];
}

// Fills in the placeholders. The template is the business's own text; values come from the order.
export function renderTemplate(text: string, values: PlaceholderValues): string {
  return text.replace(PLACEHOLDER_PATTERN, (whole, name: string) => (name in values ? values[name as PlaceholderName] : whole));
}

const COURIER_NAMES = { tcs: 'TCS', postex: 'PostEx', leopards: 'Leopards' } as const;

function rupees(amount: number): string {
  return `Rs ${amount.toLocaleString('en-PK')}`;
}

export function valuesForOrder(order: OrderDocument, settings: SettingDocument): PlaceholderValues {
  return {
    storeName: settings.store.name,
    customerName: order.customerSnapshot.name,
    orderNumber: order.orderNumber,
    orderDate: formatPktDate(order.createdAt),
    orderTotal: rupees(order.pricing.total),
    itemsList: order.items.map((i) => `${i.name} (${i.variantLabel}) x ${i.qty}`).join('\n'),
    city: order.customerSnapshot.address.city,
    deliveryEstimate: order.deliveryZone.estimateText,
    courier: order.fulfillment.courier ? COURIER_NAMES[order.fulfillment.courier] : '',
    trackingNumber: order.fulfillment.trackingNumber ?? '',
    supportWhatsapp: settings.store.whatsappNumber ? formatPkMobile(settings.store.whatsappNumber) : '',
  };
}

// For previews in the admin screen. CLEARLY FICTIONAL sample values.
export function sampleValues(settings: SettingDocument): PlaceholderValues {
  return {
    storeName: settings.store.name,
    customerName: 'Sample Customer (fictional)',
    orderNumber: `${settings.orderPrefix}-000000-0000`,
    orderDate: formatPktDate(new Date()),
    orderTotal: rupees(2100),
    itemsList: 'Sample Product (250 g) x 2',
    city: 'Sample City',
    deliveryEstimate: 'Sample estimate',
    courier: 'TCS',
    trackingNumber: 'SAMPLE123',
    supportWhatsapp: settings.store.whatsappNumber ? formatPkMobile(settings.store.whatsappNumber) : '',
  };
}