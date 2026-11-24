import { api, withQuery } from './client';

// ── Alerts (used by the dashboard) ───────────────────

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

// ── Batches ──────────────────────────────────────────

export type BatchStatus = 'active' | 'depleted' | 'written_off';
export type AdjustmentType = 'adjusted_in' | 'adjusted_out' | 'damaged' | 'expired';

export interface BatchView {
  id: string;
  batchNumber: string;
  quantityReceived: number;
  quantityRemaining: number;
  receivedDate: string; // YYYY-MM-DD (Pakistan)
  expiryDate: string;
  daysToExpiry: number;
  stopsSellingOn: string;
  isExpired: boolean;
  isSellable: boolean;
  status: BatchStatus;
  origin?: string;
  unitCost?: number;
  notes?: string;
}

export interface SizeStock {
  available: number;
  reserved: number;
}

export interface ReceiveBatchInput {
  batchNumber: string;
  quantity: number;
  receivedDate?: string; // YYYY-MM-DD, today if left out
  expiryDate: string;
  origin?: string;
  unitCost?: number;
  notes?: string;
}

export interface UpdateBatchInput {
  batchNumber?: string;
  expiryDate?: string;
  origin?: string;
  unitCost?: number;
  notes?: string;
}

// ── Stock movements ──────────────────────────────────

export type MovementType =
  | 'received'
  | 'reserved'
  | 'released'
  | 'packed'
  | 'unpacked'
  | 'adjusted_in'
  | 'adjusted_out'
  | 'damaged'
  | 'expired'
  | 'return_restocked'
  | 'return_written_off';

export interface StockMovement {
  _id: string;
  type: MovementType;
  variant: { _id: string; sku: string; label: string } | null;
  product: { _id: string; name: string } | null;
  batch: { _id: string; batchNumber: string } | null;
  quantity: number;
  order?: string;
  reason?: string;
  admin: { _id: string; name: string } | null;
  createdAt: string;
}

export interface MovementsQuery {
  variant?: string;
  batch?: string;
  type?: MovementType;
  page?: number;
  limit?: number;
}

export interface MovementsResponse {
  success: true;
  items: StockMovement[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const batchesPath = (productId: string, variantId: string, batchId?: string) =>
  `/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/batches${
    batchId ? `/${encodeURIComponent(batchId)}` : ''
  }`;

export const inventoryApi = {
  expiryAlerts: (days = 60) =>
    api.get<ExpiryAlertsResponse>(withQuery('/admin/inventory/alerts/expiry', { days })),
  lowStockAlerts: () => api.get<{ success: true; items: LowStockAlert[] }>('/admin/inventory/alerts/low-stock'),
  movements: (query: MovementsQuery = {}) =>
    api.get<MovementsResponse>(withQuery('/admin/inventory/movements', query)),
};

export const batchesApi = {
  list: (productId: string, variantId: string) =>
    api.get<{ success: true; batches: BatchView[]; stock: SizeStock }>(batchesPath(productId, variantId)),
  receive: (productId: string, variantId: string, body: ReceiveBatchInput) =>
    api.post<{ success: true; batch: BatchView; stock: SizeStock }>(batchesPath(productId, variantId), body),
  update: (productId: string, variantId: string, batchId: string, body: UpdateBatchInput) =>
    api.patch<{ success: true; batch: BatchView }>(batchesPath(productId, variantId, batchId), body),
  adjust: (productId: string, variantId: string, batchId: string, body: { type: AdjustmentType; quantity: number; reason: string }) =>
    api.post<{ success: true; batch: BatchView; stock: SizeStock }>(`${batchesPath(productId, variantId, batchId)}/adjust`, body),
};