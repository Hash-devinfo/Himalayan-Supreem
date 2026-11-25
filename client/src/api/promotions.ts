import { api, withQuery } from './client';

// "welcome" and members-only offers need customer accounts, which come later, so the admin can't create them yet
export type PromotionType = 'code' | 'product' | 'category' | 'seasonal' | 'welcome';
export type DiscountType = 'percent' | 'fixed';
export type PromotionStatus = 'active' | 'paused' | 'ended';

export interface Promotion {
  id: string;
  name: string; // customers see this in the cart, e.g. "Eid sale"
  type: PromotionType;
  code?: string;
  discountType: DiscountType;
  value: number; // percent (1-100) or rupees
  maxDiscount?: number; // percentage codes only
  products: string[];
  categories: string[];
  wholeStore: boolean; // no products and no categories chosen
  minOrderTotal?: number; // codes only
  startsOn: string; // YYYY-MM-DD
  endsOn: string | null; // the last day, YYYY-MM-DD
  usageLimit?: number; // codes only
  perCustomerLimit?: number; // codes only, per phone number
  usageCount: number;
  status: PromotionStatus;
  live: boolean; // customers are getting it right now
  state: string; // e.g. "Running", "Starts 2026-12-01", "Used up"
}

export interface PromotionListQuery {
  status?: PromotionStatus;
  type?: PromotionType;
  search?: string; // name or code
  page?: number;
  limit?: number;
}

export interface PromotionListResponse {
  success: true;
  items: Promotion[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PromotionDetailResponse {
  success: true;
  promotion: Promotion;
  usage: { orders: number; discountGiven: number };
}

export interface CreatePromotionInput {
  name: string;
  type: Exclude<PromotionType, 'welcome'>;
  code?: string;
  discountType: DiscountType;
  value: number;
  maxDiscount?: number;
  products: string[];
  categories: string[];
  minOrderTotal?: number;
  startsOn?: string;
  endsOn?: string;
  usageLimit?: number;
  perCustomerLimit?: number;
  status: 'active' | 'paused';
}

// The type can't change after creating. null clears an optional field.
export interface UpdatePromotionInput {
  name?: string;
  code?: string;
  discountType?: DiscountType;
  value?: number;
  maxDiscount?: number | null;
  products?: string[];
  categories?: string[];
  minOrderTotal?: number | null;
  startsOn?: string;
  endsOn?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
}

type PromotionResponse = { success: true; promotion: Promotion };

const promoPath = (id: string) => `/admin/promotions/${encodeURIComponent(id)}`;

export const promotionsApi = {
  list: (query: PromotionListQuery = {}) => api.get<PromotionListResponse>(withQuery('/admin/promotions', query)),
  get: (id: string) => api.get<PromotionDetailResponse>(promoPath(id)),
  create: (body: CreatePromotionInput) => api.post<PromotionResponse>('/admin/promotions', body),
  update: (id: string, body: UpdatePromotionInput) => api.patch<PromotionResponse>(promoPath(id), body),
  pause: (id: string) => api.post<PromotionResponse>(`${promoPath(id)}/pause`, {}),
  resume: (id: string) => api.post<PromotionResponse>(`${promoPath(id)}/resume`, {}),
  end: (id: string) => api.post<PromotionResponse>(`${promoPath(id)}/end`, {}),
};