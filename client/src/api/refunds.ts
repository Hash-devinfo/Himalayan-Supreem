import { api, withQuery } from './client';

export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'paid';

export interface RefundListResponse {
  success: true;
  refunds: unknown[]; // typed properly when we build the Refunds screen
  total: number;
  page: number;
  pages: number;
}

export const refundsApi = {
  list: (query: { status?: RefundStatus; order?: string; page?: number; limit?: number } = {}) =>
    api.get<RefundListResponse>(withQuery('/admin/refunds', query)),
};