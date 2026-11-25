import { ApiError } from '../../../api/client';
import type { NotificationChannel, NotificationStatus } from '../../../api/notifications';

export const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  whatsapp_link: 'WhatsApp (sent by you)',
  whatsapp_api: 'WhatsApp (automatic)',
};

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const STATUS_INFO: Record<NotificationStatus, { label: string; tone: Tone }> = {
  queued: { label: 'Sending', tone: 'info' },
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  prepared: { label: 'Opened in WhatsApp', tone: 'neutral' },
};

// Same pattern as the server: {{name}} or {{ name }}
const PLACEHOLDER = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

export function unknownPlaceholders(text: string, known: Set<string>): string[] {
  const unknown = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER)) {
    const name = match[1] ?? '';
    if (!known.has(name)) unknown.add(name);
  }
  return [...unknown];
}

// For the live preview while typing. CLEARLY FICTIONAL sample values; the real ones come from each order.
const SAMPLE: Record<string, string> = {
  customerName: 'Sample Customer (fictional)',
  orderNumber: 'ORD-000000-0000',
  orderDate: '2026-01-01',
  orderTotal: 'Rs 2,100',
  itemsList: 'Sample Product (250 g) x 2',
  city: 'Sample City',
  deliveryEstimate: 'Sample estimate',
  courier: 'TCS',
  trackingNumber: 'SAMPLE123',
  reviewLink: 'https://example.com/review?order=SAMPLE',
};

export function previewText(text: string, storeName: string, supportWhatsapp: string): string {
  const values: Record<string, string> = { ...SAMPLE, storeName, supportWhatsapp };
  return text.replace(PLACEHOLDER, (whole, name: string) => values[name] ?? whole);
}