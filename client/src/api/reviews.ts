import { api, withQuery } from './client';

export type ReviewStatus = 'pending' | 'published' | 'hidden' | 'removed';
export type ModerationStatus = Exclude<ReviewStatus, 'pending'>;

export interface AdminReview {
  id: string;
  product: { _id: string; name: string; slug: string } | null; // null if the product was deleted
  variantLabel: string;
  orderNumber: string;
  displayName: string; // shown on the website, e.g. "Ayesha K."
  rating: number; // 1-5
  title?: string;
  body?: string;
  status: ReviewStatus;
  moderationNote?: string; // admin only
  date: string; // YYYY-MM-DD
}

export interface ReviewListQuery {
  status?: ReviewStatus; // the server uses 'pending' when left out
  product?: string; // product ID
  rating?: number;
  search?: string; // order number or customer name
  page?: number;
  limit?: number;
}

export interface ReviewListResponse {
  success: true;
  items: AdminReview[];
  counts: Record<ReviewStatus, number>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ModerateReviewResponse {
  success: true;
  review: { id: string; status: ReviewStatus; product: string };
}

export const reviewsAdminApi = {
  list: (query: ReviewListQuery = {}) => api.get<ReviewListResponse>(withQuery('/admin/reviews', query)),
  // A note is required for hidden or removed; customers never see it
  moderate: (id: string, status: ModerationStatus, note?: string) =>
    api.patch<ModerateReviewResponse>(`/admin/reviews/${encodeURIComponent(id)}/status`, note ? { status, note } : { status }),
};