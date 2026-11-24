import { api } from './client';

export interface StoreSettings {
  _id: 'store';
  store: { name: string; email?: string; whatsappNumber?: string; supportHours?: string };
  orderPrefix: string;
  freeDeliveryThreshold?: number; // Rs; missing = no free delivery
  defaultPackagingCost?: number; // Rs, for profit reports
  inventory: { sellByCutoffDays: number; expiryWarningDays: number; defaultLowStockThreshold: number };
  risk: { refusalThreshold: number; dailyOrderLimit: number };
  createdAt: string;
  updatedAt: string;
}

export interface SettingsUpdate {
  store?: Partial<{ name: string; email: string; whatsappNumber: string; supportHours: string }>;
  orderPrefix?: string;
  freeDeliveryThreshold?: number | null; // null turns free delivery off
  defaultPackagingCost?: number;
  inventory?: Partial<StoreSettings['inventory']>;
  risk?: Partial<StoreSettings['risk']>;
}

export const settingsApi = {
  get: () => api.get<{ success: true; settings: StoreSettings }>('/admin/settings'),
  update: (body: SettingsUpdate) => api.patch<{ success: true; settings: StoreSettings }>('/admin/settings', body),
};