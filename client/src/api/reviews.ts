import { api, withQuery } from './client';

export type ReviewStatus = 'pending' | 'published' | 'hidden' | 'removed';

export interface ReviewListResponse {
  success: true;
  items: unknown[]; // typed properly when we build the Reviews screen
  counts: Record<ReviewStatus, number>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const reviewsAdminApi = {
  list: (query: { status?: ReviewStatus; page?: number; limit?: number } = {}) =>
    api.get<ReviewListResponse>(withQuery('/admin/reviews', query)),
};