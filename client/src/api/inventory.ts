import { api, withQuery } from './client';

export interface ExpiryAlert {
  batchId: string;
  batchNumber: string;
  product: string;
  sku: string;
  label: string;
  quantityRemaining: number;
  expiryDate: string; // YYYY-MM-DD
  stopsSellingOn: string; // YYYY-MM-DD
  daysToExpiry: number;
}

export interface ExpiryAlertsResponse {
  success: true;
  days: number;
  expiringSoon: ExpiryAlert[];
  stoppedSelling: ExpiryAlert[];
}

export interface LowStockAlert {
  variantId: string;
  productId: string;
  product: string;
  sku: string;
  label: string;
  availableQty: number;
  reservedQty: number;
  threshold: number;
}

export const inventoryApi = {
  expiryAlerts: (days = 60) =>
    api.get<ExpiryAlertsResponse>(withQuery('/admin/inventory/alerts/expiry', { days })),
  lowStockAlerts: () => api.get<{ success: true; items: LowStockAlert[] }>('/admin/inventory/alerts/low-stock'),
};