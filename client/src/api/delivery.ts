import { api, withQuery } from './client';
import type { Province } from '../lib/pakistan';

// ── Public (checkout) ────────────────────────────────

export interface CityOption {
  _id: string;
  name: string;
  province: Province;
}

// ── Admin: zones ─────────────────────────────────────

export interface WeightRule {
  upToGrams: number;
  charge: number; // Rs
}

export interface DeliveryZone {
  _id: string;
  name: string;
  charge: number; // Rs, used when the zone has no weight rules
  estimateText: string; // shown to customers, e.g. "2–4 working days"
  weightRules: WeightRule[]; // lightest first; replace the flat charge when present
  isDefault: boolean; // used by every city without its own zone
  active: boolean;
  sortOrder: number;
  cityCount: number; // the default zone also counts cities without a zone
  createdAt: string;
  updatedAt: string;
}

export interface ZoneListResponse {
  success: true;
  zones: DeliveryZone[];
  hasDefault: boolean;
  citiesWithoutZone: number;
}

export interface ZoneInput {
  name: string;
  charge: number;
  estimateText: string;
  weightRules: WeightRule[];
}

// ── Admin: cities ────────────────────────────────────

export type CitySource = 'seed' | 'admin' | 'customer';

export interface AdminCity {
  _id: string;
  name: string;
  province: Province;
  zone: { _id: string; name: string } | null; // null = uses the default zone
  isBlocked: boolean; // true only when no courier delivers there
  source: CitySource;
  sortOrder: number; // lower = higher in the checkout list
}

export interface CityListQuery {
  search?: string;
  province?: Province;
  zone?: string; // a zone ID, or "default" for cities without their own zone
  blocked?: 'true' | 'false';
  page?: number;
  limit?: number;
}

export interface CityListResponse {
  success: true;
  cities: AdminCity[];
  total: number;
  page: number;
  pages: number;
}

export interface CityUpdate {
  zone?: string | null; // null = back to the default zone
  isBlocked?: boolean;
  sortOrder?: number;
}

export interface AssignZoneResponse {
  success: true;
  changed: number;
  alreadyInZone: number;
  notFound: number;
}

export const deliveryApi = {
  // Cities customers can choose (blocked cities left out). The server lets browsers cache it for 10 minutes.
  publicCities: () => api.get<{ success: true; cities: CityOption[] }>('/delivery/cities'),
};

export const deliveryAdminApi = {
  zones: () => api.get<ZoneListResponse>('/admin/delivery/zones'),
  createZone: (body: ZoneInput) => api.post<{ success: true; zone: DeliveryZone }>('/admin/delivery/zones', body),
  updateZone: (id: string, body: Partial<ZoneInput> & { active?: boolean }) =>
    api.patch<{ success: true; zone: DeliveryZone }>(`/admin/delivery/zones/${id}`, body),
  makeDefault: (id: string) => api.post<{ success: true; zone: DeliveryZone }>(`/admin/delivery/zones/${id}/make-default`, {}),

  cities: (query: CityListQuery) => api.get<CityListResponse>(withQuery('/admin/delivery/cities', query)),
  createCity: (body: { name: string; province: Province; zone?: string | null; sortOrder?: number }) =>
    api.post<{ success: true; city: AdminCity }>('/admin/delivery/cities', body),
  updateCity: (id: string, body: CityUpdate) => api.patch<{ success: true; city: AdminCity }>(`/admin/delivery/cities/${id}`, body),
  assignZone: (cityIds: string[], zone: string | null) =>
    api.post<AssignZoneResponse>('/admin/delivery/cities/assign-zone', { cityIds, zone }),
};