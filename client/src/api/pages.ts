import { api } from './client';

export type PageSlug = 'refund' | 'privacy' | 'delivery' | 'terms' | 'review-rules';
export type PageStatus = 'placeholder' | 'needs_review' | 'approved';

type AdminRef = { _id: string; name: string } | null | undefined;

export interface PolicyPageSummary {
  slug: PageSlug;
  title: string;
  status: PageStatus;
  updatedAt: string;
  approvedAt: string | null;
  mustCover: string[]; // notes for the business, never shown to customers
}

export interface PolicyPage {
  _id: string;
  slug: PageSlug;
  title: string;
  content: string; // plain text: # headings, - lists
  status: PageStatus;
  updatedBy?: AdminRef;
  approvedBy?: AdminRef;
  approvedAt?: string;
  updatedAt: string;
}

export interface PublicPage {
  slug: PageSlug;
  title: string;
  content: string;
  reviewPending: boolean; // the storefront shows a "draft" notice until approved
  updatedAt: string;
}

const adminPath = (slug: string) => `/admin/pages/${encodeURIComponent(slug)}`;

export const pagesAdminApi = {
  list: () => api.get<{ success: true; pages: PolicyPageSummary[]; allApproved: boolean }>('/admin/pages'),
  get: (slug: string) => api.get<{ success: true; page: PolicyPage; mustCover: string[] }>(adminPath(slug)),
  // Any edit sends the page back to "needs review"
  update: (slug: string, body: { title?: string; content?: string }) =>
    api.put<{ success: true; page: PolicyPage }>(adminPath(slug), body),
  approve: (slug: string) => api.post<{ success: true; page: PolicyPage }>(`${adminPath(slug)}/approve`, {}),
};

// For the storefront footer, checkout links and the policy pages
export const pagesApi = {
  list: () => api.get<{ success: true; pages: { slug: PageSlug; title: string; reviewPending: boolean }[] }>('/pages'),
  get: (slug: string) => api.get<{ success: true; page: PublicPage }>(`/pages/${encodeURIComponent(slug)}`),
};