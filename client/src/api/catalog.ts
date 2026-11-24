import { api, withQuery } from './client';

// Same lists as server/src/constants/enums.ts
export type ProductStatus = 'draft' | 'published' | 'unpublished' | 'archived';
export type CategoryStatus = 'active' | 'hidden' | 'archived';
export type VariantStatus = 'active' | 'unavailable' | 'archived';
export type SizeUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';

export interface AdminCategory {
  _id: string;
  name: string;
  slug: string;
  status: CategoryStatus;
  description?: string;
  sortOrder?: number;
}

export interface CategoryRef {
  _id: string;
  name: string;
  slug: string;
  status?: CategoryStatus;
}

export interface AdminProduct {
  _id: string;
  name: string;
  slug: string;
  category: CategoryRef; // filled in by the list and details endpoints
  shortDescription?: string;
  description?: string;
  images: { url: string; publicId: string; alt: string }[];
  ingredients?: string;
  allergens?: string;
  storageInstructions?: string;
  usageDirections?: string;
  origin?: string;
  claims: string[];
  tags: string[];
  certificates: string[];
  status: ProductStatus;
  seo?: { title?: string; description?: string };
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVariant {
  _id: string;
  product: string;
  sku: string;
  label: string;
  sizeValue: number;
  sizeUnit: SizeUnit;
  price: number;
  costPrice?: number;
  shippingWeightGrams: number;
  lowStockThreshold?: number;
  reservedQty: number;
  availableQty: number;
  status: VariantStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name?: string;
  category?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  ingredients?: string;
  allergens?: string;
  storageInstructions?: string;
  usageDirections?: string;
  origin?: string;
  claims?: string[];
  tags?: string[];
  seo?: { title?: string; description?: string };
}

export interface ProductListQuery {
  status?: ProductStatus;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProductListResponse {
  success: true;
  items: AdminProduct[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const productPath = (id: string) => `/admin/products/${encodeURIComponent(id)}`;

export const productsAdminApi = {
  list: (query: ProductListQuery = {}) => api.get<ProductListResponse>(withQuery('/admin/products', query)),
  get: (id: string) => api.get<{ success: true; product: AdminProduct; variants: AdminVariant[] }>(productPath(id)),
  // Create and update answer with the product (its category as a plain ID)
  create: (body: ProductInput & { name: string; category: string }) =>
    api.post<{ success: true; product: { _id: string } }>('/admin/products', body),
  update: (id: string, body: ProductInput) => api.patch<{ success: true; product: { _id: string } }>(productPath(id), body),
  changeStatus: (id: string, status: ProductStatus) =>
    api.patch<{ success: true; product: { _id: string; status: ProductStatus } }>(`${productPath(id)}/status`, { status }),
};

export const categoriesAdminApi = {
  list: (status?: CategoryStatus) =>
    api.get<{ success: true; categories: AdminCategory[] }>(withQuery('/admin/categories', { status })),
};