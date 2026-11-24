import { api, withQuery } from './client';
import type { PaymentStatus, PhoneRisk } from './orders';

export type CustomerFilter = 'blocked' | 'highRisk';

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string; // formatted for reading, e.g. 0300 1234567
  email: string | null;
  phoneVerified: boolean;
  risk: PhoneRisk;
  lastOrderAt: string | null;
}

export interface CustomerListResponse {
  success: true;
  customers: CustomerListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface CustomerDetailResponse {
  success: true;
  phone: string;
  customer: {
    name: string;
    email: string | null;
    phoneVerified: boolean;
    isBlocked: boolean;
    blockedReason: string | null;
    blockedAt: string | null;
    blockedBy: string | null;
  } | null; // null: this number has never ordered and was never blocked
  risk: PhoneRisk;
  recentOrders: {
    orderNumber: string;
    status: string; // label, e.g. "Delivered"
    placedOn: string; // YYYY-MM-DD
    city: string;
    total: number;
    payment: PaymentStatus;
  }[];
}

// The server accepts 03001234567, 0300-1234567 or +923001234567 in the address
export const phoneForUrl = (phone: string) => phone.replace(/[^\d+]/g, '');

const customerPath = (phone: string) => `/admin/customers/${encodeURIComponent(phoneForUrl(phone))}`;

export const customersApi = {
  list: (query: { search?: string; filter?: CustomerFilter; page?: number; limit?: number } = {}) =>
    api.get<CustomerListResponse>(withQuery('/admin/customers', query)),
  get: (phone: string) => api.get<CustomerDetailResponse>(customerPath(phone)),
  block: (phone: string, reason: string) => api.post<CustomerDetailResponse>(`${customerPath(phone)}/block`, { reason }),
  unblock: (phone: string, note?: string) =>
    api.post<CustomerDetailResponse>(`${customerPath(phone)}/unblock`, note ? { note } : {}),
};