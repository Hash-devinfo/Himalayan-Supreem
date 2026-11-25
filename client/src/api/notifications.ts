import { api, withQuery } from './client';

export type TemplateKey = 'orderPlaced' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'deliveryFailed' | 'missedCall';
export type NotificationChannel = 'email' | 'whatsapp_link' | 'whatsapp_api';
export type NotificationStatus = 'queued' | 'sent' | 'failed' | 'prepared';

export interface MessageTemplate {
  key: TemplateKey;
  label: string;
  email: boolean; // can this message go by email?
  whatsapp: boolean;
  emailSubject: string | null;
  emailBody: string | null;
  whatsappBody: string | null;
  emailReady: boolean; // written, so it will be sent
  whatsappReady: boolean;
}

export interface PlaceholderInfo {
  placeholder: string; // e.g. "{{orderNumber}}"
  meaning: string;
}

export interface TemplateUpdate {
  emailSubject?: string | null; // "" or null clears it, so that message is not sent
  emailBody?: string | null;
  whatsappBody?: string | null;
}

export interface NotificationLogItem {
  id: string;
  orderNumber: string | null;
  channel: NotificationChannel;
  template: TemplateKey;
  label: string;
  recipient: string;
  subject: string | null;
  status: NotificationStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationListQuery {
  order?: string; // order number
  status?: NotificationStatus;
  channel?: NotificationChannel;
  page?: number;
  limit?: number;
}

export interface WhatsappOptions {
  success: true;
  orderNumber: string;
  suggested: TemplateKey | null; // the message that fits the order's current step
  messages: { key: TemplateKey; label: string; ready: boolean; suggested: boolean }[];
}

export const notificationsApi = {
  templates: () =>
    api.get<{ success: true; templates: MessageTemplate[]; placeholders: PlaceholderInfo[] }>('/admin/notifications/templates'),
  updateTemplate: (key: TemplateKey, body: TemplateUpdate) =>
    api.put<{ success: true; template: MessageTemplate }>(`/admin/notifications/templates/${key}`, body),

  log: (query: NotificationListQuery) =>
    api.get<{ success: true; notifications: NotificationLogItem[]; total: number; page: number; pages: number }>(
      withQuery('/admin/notifications', query),
    ),
  retry: (id: string) => api.post<{ success: true; notification: { status: NotificationStatus; lastError?: string } }>(
    `/admin/notifications/${encodeURIComponent(id)}/retry`,
    {},
  ),

  whatsappOptions: (orderNumber: string) =>
    api.get<WhatsappOptions>(`/admin/notifications/orders/${encodeURIComponent(orderNumber)}/whatsapp`),
  // Fills in the message for this order and logs it as "prepared"; the admin presses Send in WhatsApp
  prepareWhatsapp: (orderNumber: string, key: TemplateKey) =>
    api.post<{ success: true; link: string; text: string; notificationId: string }>(
      `/admin/notifications/orders/${encodeURIComponent(orderNumber)}/whatsapp/${key}`,
      {},
    ),
};