import { api, withQuery } from './client';

// Same list as server/src/constants/enums.ts
export const ORDER_STATUSES = [
  'new',
  'contact_attempt_1',
  'contact_attempt_2',
  'contact_attempt_3',
  'confirmed',
  'packing',
  'shipped',
  'delivered',
  'delivery_failed',
  'returned',
  'cancelled',
  'refund_pending',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type RiskLevel = 'normal' | 'high' | 'blocked';
export type OrderFlag = 'unlistedCity' | 'stockShortfall' | 'cancellationRequested';

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  placedAt: string;
  customerName: string;
  phone: string;
  city: string;
  total: number;
  units: number;
  calls: number;
  flags: { unlistedCity?: boolean; stockShortfall?: boolean; cancellationRequested: boolean };
  risk: RiskLevel;
}

export interface OrderListQuery {
  status?: OrderStatus;
  search?: string;
  from?: string;
  to?: string;
  flag?: OrderFlag;
  page?: number;
  limit?: number;
}

export interface OrderListResponse {
  success: true;
  orders: OrderListItem[];
  total: number;
  page: number;
  pages: number;
}
export interface OrderChangeResponse {
  success: true;
  order: OrderDetail;
  statusLabel?: string;
}

export interface LogCallResponse extends OrderChangeResponse {
  whatsappLink?: string; // only after a missed call
  canCancelForNoAnswer: boolean; // true after the third missed call
}

const orderPath = (idOrNumber: string) => `/admin/orders/${encodeURIComponent(idOrNumber)}`;

export const ordersApi = {
  list: (query: OrderListQuery = {}) => api.get<OrderListResponse>(withQuery('/admin/orders', query)),
  // Accepts the database ID or the order number
  get: (idOrNumber: string) => api.get<OrderDetailResponse>(orderPath(idOrNumber)),

  logCall: (idOrNumber: string, body: { outcome: ContactOutcome; note?: string }) =>
    api.post<LogCallResponse>(`${orderPath(idOrNumber)}/calls`, body),
  cancel: (idOrNumber: string, reason: string) =>
    api.post<OrderChangeResponse>(`${orderPath(idOrNumber)}/cancel`, { reason }),
  updateNotes: (idOrNumber: string, adminNotes: string) =>
    api.patch<OrderChangeResponse>(`${orderPath(idOrNumber)}/notes`, { adminNotes }),
  recordCancellationRequest: (idOrNumber: string, reason?: string) =>
    api.post<OrderChangeResponse>(`${orderPath(idOrNumber)}/cancellation-request`, reason ? { reason } : {}),
  declineCancellationRequest: (idOrNumber: string, note: string) =>
    api.post<OrderChangeResponse>(`${orderPath(idOrNumber)}/cancellation-request/decline`, { note }),
};
export type ContactOutcome = 'no_answer' | 'busy' | 'switched_off' | 'wrong_number' | 'confirmed' | 'customer_cancelled';
export type OrderChannel = 'website' | 'whatsapp' | 'phone' | 'other';
export type PaymentStatus = 'pending' | 'collected' | 'refused' | 'uncollected' | 'refunded' | 'partially_refunded';
export type Courier = 'tcs' | 'postex' | 'leopards';
export type CancellationSource = 'status_page' | 'whatsapp' | 'admin';

export interface OrderDetail {
  _id: string;
  orderNumber: string;
  customer: string;
  customerSnapshot: {
    name: string;
    phone: string;
    email?: string;
    address: {
      line1: string;
      line2?: string;
      area?: string;
      city: string;
      cityUnlisted: boolean;
      province: string;
    };
  };
  items: {
    _id?: string;
    product: string;
    variant: string;
    name: string;
    variantLabel: string;
    sku: string;
    unitPrice: number;
    unitCost?: number;
    qty: number;
    discount: number;
    lineTotal: number;
    promotionName?: string;
    batchAllocations: { batch: string; batchNumber: string; expiryDate: string; qty: number }[];
  }[];
  pricing: { subtotal: number; discountTotal: number; deliveryCharge: number; total: number };
  deliveryZone?: { zone: string; name: string; estimateText: string };
  payment: {
    method: 'cod';
    status: PaymentStatus;
    amountCollected?: number;
    collectedAt?: string;
    remittanceStatus?: 'pending' | 'remitted';
    remittedAt?: string;
    remittanceRef?: string;
  };
  status: OrderStatus;
  statusHistory: { _id?: string; status: OrderStatus; at: string; by?: string; note?: string }[];
  contactAttempts: { _id?: string; attemptNo: number; at: string; outcome: ContactOutcome; note?: string; by?: string }[];
  cancellation?: {
    requestStatus?: 'requested' | 'approved' | 'declined';
    requestedVia?: CancellationSource;
    requestedAt?: string;
    reason?: string;
    confirmedOnCall?: boolean;
    decidedAt?: string;
  };
  fulfillment?: {
    courier?: Courier;
    trackingNumber?: string;
    dispatchedAt?: string;
    deliveredAt?: string;
    failedAt?: string;
    failureReason?: string;
    returnedAt?: string;
    returnDecision?: 'restock' | 'write_off';
  };
  flags: { stockShortfall: boolean; unlistedCity: boolean };
  adminNotes?: string;
  source?: {
    channel: OrderChannel;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
  promotion?: { code: string; name: string; discount: number };
  createdAt: string;
  updatedAt: string;
}

export interface PhoneRisk {
  level: RiskLevel;
  orders: number;
  delivered: number;
  refused: number; // refused or not collected at the door
  cancelled: number;
  blockedReason: string | null;
}

export interface OrderDetailResponse {
  success: true;
  order: OrderDetail;
  statusLabel: string;
  risk: PhoneRisk;
  contact: { phone: string; callLink: string; whatsappLink: string };
}