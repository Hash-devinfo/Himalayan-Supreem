import { api, withQuery } from './client';

// Same list as server/src/constants/enums.ts
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

export type RiskLevel = 'normal' | 'high' | 'blocked';
export type OrderFlag = 'unlistedCity' | 'stockShortfall' | 'cancellationRequested';

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  placedAt: string;
  customerName: string;
  phone: string;
  city: string;
  total: number;
  units: number;
  calls: number;
  flags: { unlistedCity?: boolean; stockShortfall?: boolean; cancellationRequested: boolean };
  risk: RiskLevel;
}

export interface OrderListQuery {
  status?: OrderStatus;
  search?: string;
  from?: string;
  to?: string;
  flag?: OrderFlag;
  page?: number;
  limit?: number;
}

export interface OrderListResponse {
  success: true;
  orders: OrderListItem[];
  total: number;
  page: number;
  pages: number;
}

export const ordersApi = {
  list: (query: OrderListQuery = {}) => api.get<OrderListResponse>(withQuery('/admin/orders', query)),
};