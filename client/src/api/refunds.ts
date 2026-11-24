import { api, withQuery } from './client';
import type { PaymentStatus } from './orders';

export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'paid';
export type RefundReason = 'damaged' | 'incorrect';

// Admin names come filled in on the refund screen; elsewhere only the ID comes back
export type AdminRef = string | { _id: string; name: string } | null | undefined;

export interface RefundItem {
  variant: string;
  name: string;
  variantLabel: string;
  sku: string;
  qty: number;
  amount: number;
}

export interface Refund {
  _id: string;
  order: string;
  orderNumber: string;
  items: RefundItem[];
  reason: RefundReason;
  description: string;
  amount: number;
  status: RefundStatus;
  payoutMethod?: string;
  payoutReference?: string;
  stockAction: 'none' | 'written_off';
  rejectionReason?: string;
  requestedBy: AdminRef;
  decidedBy?: AdminRef;
  decidedAt?: string;
  paidBy?: AdminRef;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RefundListItem = Pick<Refund, '_id' | 'orderNumber' | 'reason' | 'amount' | 'status' | 'payoutMethod' | 'createdAt' | 'paidAt'>;

export interface RefundListQuery {
  status?: RefundStatus;
  order?: string; // order number
  page?: number;
  limit?: number;
}

export interface RefundListResponse {
  success: true;
  refunds: RefundListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface RefundDetailResponse {
  success: true;
  refund: Refund;
  order: { status: string; statusLabel: string; amountCollected: number } | null;
}

export interface RefundChangeResponse {
  success: true;
  refund: Refund;
  orderStatus?: string; // label, e.g. "Refund pending"
  paymentStatus?: PaymentStatus;
}

export interface CreateRefundInput {
  order: string; // order number
  reason: RefundReason;
  description: string;
  items: { variantId: string; qty: number; amount?: number }[];
}

export interface PayRefundInput {
  payoutMethod: string;
  payoutReference?: string;
  paidOn?: string; // YYYY-MM-DD
  writeOff: boolean;
}

export const adminName = (ref: AdminRef) => (ref && typeof ref === 'object' ? ref.name : null);

const refundPath = (id: string) => `/admin/refunds/${encodeURIComponent(id)}`;

export const refundsApi = {
  list: (query: RefundListQuery = {}) => api.get<RefundListResponse>(withQuery('/admin/refunds', query)),
  get: (id: string) => api.get<RefundDetailResponse>(refundPath(id)),
  create: (body: CreateRefundInput) => api.post<RefundChangeResponse>('/admin/refunds', body),
  approve: (id: string) => api.post<RefundChangeResponse>(`${refundPath(id)}/approve`, {}),
  reject: (id: string, reason: string) => api.post<RefundChangeResponse>(`${refundPath(id)}/reject`, { reason }),
  pay: (id: string, body: PayRefundInput) => api.post<RefundChangeResponse>(`${refundPath(id)}/pay`, body),
};