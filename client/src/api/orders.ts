import { api, withQuery } from "./client";

// Same list as server/src/constants/enums.ts
export const ORDER_STATUSES = [
  "new",
  "contact_attempt_1",
  "contact_attempt_2",
  "contact_attempt_3",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
  "delivery_failed",
  "returned",
  "cancelled",
  "refund_pending",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type RiskLevel = "normal" | "high" | "blocked";
export type OrderFlag =
  | "unlistedCity"
  | "stockShortfall"
  | "cancellationRequested";

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
  flags: {
    unlistedCity?: boolean;
    stockShortfall?: boolean;
    cancellationRequested: boolean;
  };
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

export interface PackingBatchChoice {
  batchId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  daysToExpiry: number;
  quantityRemaining: number;
}

export interface PackingPlanItem {
  variantId: string;
  name: string;
  variantLabel: string;
  sku: string;
  qty: number;
  batches: PackingBatchChoice[]; // sellable only, earliest expiry first
  suggested: { batchId: string; qty: number }[];
  shortBy: number;
}

export interface PackingPlanResponse {
  success: true;
  orderNumber: string;
  items: PackingPlanItem[];
  canPack: boolean;
}

export interface PackAllocationInput {
  variantId: string;
  allocations: { batchId: string; qty: number }[];
}

export interface CourierOption {
  code: Courier;
  name: string;
  mode: "manual" | "api";
}

export interface ShipInput {
  courier?: Courier;
  trackingNumber?: string;
  courierFee?: number;
  codCharge?: number;
  note?: string;
}

export interface UpdateContactInput {
  name?: string;
  phone?: string;
  email?: string | null; // null removes the email
  address?: {
    line1: string;
    line2?: string;
    area?: string;
    cityId?: string; // a city from the list...
    cityName?: string; // ...or a typed city with its province
    province?: string;
  };
  recalculateDelivery?: boolean;
  note?: string;
}

export interface UpdateContactResponse extends OrderChangeResponse {
  changed: boolean;
  delivery?: {
    agreedCharge: number;
    newCityCharge: number;
    zone: string;
    estimate: string;
    applied: boolean;
  };
}
const orderPath = (idOrNumber: string) =>
  `/admin/orders/${encodeURIComponent(idOrNumber)}`;

export const ordersApi = {
  list: (query: OrderListQuery = {}) =>
    api.get<OrderListResponse>(withQuery("/admin/orders", query)),
  // Accepts the database ID or the order number
  get: (idOrNumber: string) =>
    api.get<OrderDetailResponse>(orderPath(idOrNumber)),

  logCall: (
    idOrNumber: string,
    body: { outcome: ContactOutcome; note?: string },
  ) => api.post<LogCallResponse>(`${orderPath(idOrNumber)}/calls`, body),
  cancel: (idOrNumber: string, reason: string) =>
    api.post<OrderChangeResponse>(`${orderPath(idOrNumber)}/cancel`, {
      reason,
    }),
  updateNotes: (idOrNumber: string, adminNotes: string) =>
    api.patch<OrderChangeResponse>(`${orderPath(idOrNumber)}/notes`, {
      adminNotes,
    }),
  recordCancellationRequest: (idOrNumber: string, reason?: string) =>
    api.post<OrderChangeResponse>(
      `${orderPath(idOrNumber)}/cancellation-request`,
      reason ? { reason } : {},
    ),
  declineCancellationRequest: (idOrNumber: string, note: string) =>
    api.post<OrderChangeResponse>(
      `${orderPath(idOrNumber)}/cancellation-request/decline`,
      { note },
    ),
  packingPlan: (idOrNumber: string) =>
    api.get<PackingPlanResponse>(`${orderPath(idOrNumber)}/packing`),
  pack: (idOrNumber: string, items: PackAllocationInput[]) =>
    api.post<OrderChangeResponse>(`${orderPath(idOrNumber)}/pack`, { items }),
  unpack: (idOrNumber: string, reason: string) =>
    api.post<OrderChangeResponse>(`${orderPath(idOrNumber)}/unpack`, {
      reason,
    }),
  couriers: () =>
    api.get<{ success: true; couriers: CourierOption[] }>(
      "/admin/orders/couriers",
    ),
  ship: (idOrNumber: string, body: ShipInput) =>
    api.post<OrderChangeResponse>(`${orderPath(idOrNumber)}/ship`, body),
  updateContact: (idOrNumber: string, body: UpdateContactInput) =>
    api.patch<UpdateContactResponse>(`${orderPath(idOrNumber)}/contact`, body),
    deliver: (idOrNumber: string, body: { amountCollected?: number; note?: string }) =>
    api.post<OrderChangeResponse>(`${orderPath(idOrNumber)}/deliver`, body),
  failDelivery: (idOrNumber: string, body: { reason: DeliveryFailureReason; note?: string }) =>
    api.post<OrderChangeResponse & { whatsappLink: string }>(`${orderPath(idOrNumber)}/fail`, body),
  returnOrder: (
    idOrNumber: string,
    body: { items: { variantId: string; decision: ReturnDecision; reason?: string }[]; note?: string },
  ) => api.post<OrderChangeResponse>(`${orderPath(idOrNumber)}/return`, body),
  // The courier paid the store the COD money for these orders (all or nothing)
  remit: (body: { orders: string[]; reference: string; remittedOn?: string }) =>
    api.post<{ success: true; count: number; total: number; orders: string[] }>('/admin/orders/remit', body),
};
export type ContactOutcome =
  | "no_answer"
  | "busy"
  | "switched_off"
  | "wrong_number"
  | "confirmed"
  | "customer_cancelled";
export type OrderChannel = "website" | "whatsapp" | "phone" | "other";
export type PaymentStatus =
  | "pending"
  | "collected"
  | "refused"
  | "uncollected"
  | "refunded"
  | "partially_refunded";
export type Courier = "tcs" | "postex" | "leopards";
export type CancellationSource = "status_page" | "whatsapp" | "admin";
export type DeliveryFailureReason = 'refused' | 'uncollected' | 'address_issue' | 'other';
export type ReturnDecision = 'restock' | 'write_off';
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
      cityRef?: string;
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
    batchAllocations: {
      batch: string;
      batchNumber: string;
      expiryDate: string;
      qty: number;
    }[];
  }[];
  pricing: {
    subtotal: number;
    discountTotal: number;
    deliveryCharge: number;
    total: number;
  };
  deliveryZone?: { zone: string; name: string; estimateText: string };
  payment: {
    method: "cod";
    status: PaymentStatus;
    amountCollected?: number;
    collectedAt?: string;
    remittanceStatus?: "pending" | "remitted";
    remittedAt?: string;
    remittanceRef?: string;
  };
  status: OrderStatus;
  statusHistory: {
    _id?: string;
    status: OrderStatus;
    at: string;
    by?: string;
    note?: string;
  }[];
  contactAttempts: {
    _id?: string;
    attemptNo: number;
    at: string;
    outcome: ContactOutcome;
    note?: string;
    by?: string;
  }[];
  cancellation?: {
    requestStatus?: "requested" | "approved" | "declined";
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
    returnDecision?: "restock" | "write_off";
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
