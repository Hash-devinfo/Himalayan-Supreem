import { api } from './client';
import type { Courier } from './orders';

const orderPath = (idOrNumber: string) => `/admin/orders/${encodeURIComponent(idOrNumber)}`;

interface DocumentBatch {
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  qty: number;
}

export interface DocumentItem {
  name: string;
  variantLabel: string;
  sku: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  batches: DocumentBatch[];
}

export interface Invoice {
  invoiceNumber: string;
  invoiceDate: string;
  orderStatus: string;
  seller: { name: string; email: string | null; whatsapp: string | null; supportHours: string | null };
  billTo: { name: string; phone: string; email: string | null; address: string; city: string; province: string };
  items: (DocumentItem & { discount: number })[];
  totals: { subtotal: number; discounts: number; deliveryCharge: number; total: number; refunded: number; netPaid: number };
  payment: { method: string; status: string; amountCollected: number; collectedOn: string | null };
  refunds: { amount: number; paidOn: string | null; reason: 'damaged' | 'incorrect' }[];
  currency: 'PKR';
}

export interface PackingSlip {
  store: { name: string; whatsapp: string | null; email: string | null };
  orderNumber: string;
  placedOn: string;
  packedOn: string | null;
  shipTo: { name: string; phone: string; address: string; city: string; province: string };
  items: DocumentItem[];
  pricing: { subtotal: number; discountTotal: number; deliveryCharge: number; total: number };
  payment: { method: 'cod'; amountToCollect: number };
  courier: Courier | null;
  trackingNumber: string | null;
}

export const documentsApi = {
  // notices: admin-only warnings (never printed), e.g. tax not decided yet
  invoice: (idOrNumber: string) =>
    api.get<{ success: true; invoice: Invoice; notices: string[] }>(`${orderPath(idOrNumber)}/invoice`),
  packingSlip: (idOrNumber: string) => api.get<{ success: true; slip: PackingSlip }>(`${orderPath(idOrNumber)}/packing-slip`),
};