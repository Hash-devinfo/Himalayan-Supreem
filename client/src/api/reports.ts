import { api, withQuery } from './client';
import type { ExpiryAlert, LowStockAlert } from './inventory';
import type { OrderStatus } from './orders';

// Pakistan dates, YYYY-MM-DD. Leave both out for the last 30 days.
export interface ReportRangeQuery {
  from?: string;
  to?: string;
}

export interface ReportRange {
  from: string;
  to: string;
}

// Every report explains its own numbers in plain words
type Definitions = Record<string, string>;

// ── Sales ────────────────────────────────────────────

export type SalesGroup = 'day' | 'product' | 'variant' | 'category' | 'courier';

// groupBy=day: one row per day that had deliveries (days with none are missing). Courier rows look the same.
export interface SalesDayRow {
  key: string; // YYYY-MM-DD, or the courier key
  label: string;
  orders: number;
  sales: number;
  deliveryCharges: number;
}

// groupBy=product / variant / category: biggest sellers first
export interface SalesProductRow {
  productId?: string;
  variantId?: string;
  categoryId?: string;
  sku?: string;
  label: string;
  orders: number;
  qty: number;
  gross: number;
  discounts: number;
  sales: number;
}

export interface SalesReport<Row = SalesDayRow> {
  success: true;
  range: ReportRange;
  summary: {
    deliveredOrders: number;
    grossSales: number;
    discounts: number;
    refunds: number;
    refundCount: number;
    netSales: number;
    deliveryCharges: number;
    codCollected: number;
    averageOrderValue: number;
  };
  placed: { total: number; cancelled: number; open: number; returned: number };
  groupBy: SalesGroup;
  rows: Row[];
  definitions?: Definitions;
}

// ── Profit ───────────────────────────────────────────

export interface ProfitReport {
  success: true;
  range: ReportRange;
  summary: {
    deliveredOrders: number;
    netSales: number;
    refunds: number;
    deliveryIncome: number;
    productCost: number;
    grossProfit: number;
    packagingCost: number;
    courierFees: number;
    codCharges: number;
    failedDeliveryCosts: number;
    returnedOrders: number;
    totalCosts: number;
    profit: number;
    marginPercent: number;
  };
  bySize: { sku: string; label: string; qty: number; sales: number; cost: number; grossProfit: number; marginPercent: number }[];
  missingCosts: {
    complete: boolean;
    sizesWithoutCost: string[];
    ordersWithoutCourierFee: string[];
    ordersWithoutPackagingCost: string[];
  };
  definitions: Definitions;
}

// ── Stock ────────────────────────────────────────────

export interface InventoryReport {
  success: true;
  asOf: string;
  range: ReportRange; // for movements only; stock levels are always "now"
  summary: {
    sizes: number;
    onHandUnits: number;
    availableUnits: number;
    reservedUnits: number;
    stockValue: number;
    stockValueComplete: boolean;
    lowStockSizes: number;
    expiringSoonBatches: number;
    stoppedSellingBatches: number;
  };
  stock: {
    variantId: string;
    product: string;
    sku: string;
    label: string;
    onHand: number;
    sellable: number;
    reserved: number;
    available: number;
    threshold: number;
    low: boolean;
    stockValue: number;
    costMissing: boolean;
  }[];
  lowStock: LowStockAlert[];
  expiringSoon: ExpiryAlert[];
  stoppedSelling: ExpiryAlert[];
  movements: { type: string; label: string; units: number; entries: number }[];
  sizesWithoutCost: string[];
  definitions: Definitions;
}

// ── Delivery (fulfilment) ────────────────────────────

export interface FulfillmentReport {
  success: true;
  range: ReportRange;
  summary: {
    ordersPlaced: number;
    delivered: number;
    failed: number;
    returned: number;
    successPercent: number | null;
    codHeldAmount: number;
    codHeldOrders: number;
    codRemittedAmount: number;
  };
  ordersByStatus: { status: OrderStatus; label: string; count: number }[];
  couriers?: {
    courier: string;
    label: string;
    delivered: number;
    failed: number;
    returned: number;
    successPercent: number | null;
    avgDaysToDeliver: number | null;
  }[];
  failures?: { reason: string; label: string; orders: number }[];
  codHeld?: { courier: string; label: string; orders: number; amount: number; oldestDeliveredDaysAgo: number | null }[];
  codRemitted?: { courier: string; label: string; orders: number; amount: number }[];
  definitions?: Definitions;
}

// ── Cancellations and refunds ────────────────────────

export interface CancellationsReport {
  success: true;
  range: ReportRange;
  summary: {
    ordersPlaced: number;
    cancelled: number;
    cancelledValue: number;
    cancellationPercent: number | null;
    refundsPaid: number;
    refundsPaidAmount: number;
    refundsWrittenOff: number;
    openRefunds: number;
    openRefundsAmount: number;
  };
  cancellations: {
    byType: { type: string; label: string; orders: number; value: number }[];
    recent: { orderNumber: string; date: string | null; type: string; reason: string; value: number }[];
  };
  refunds: {
    paidByReason: { reason: string; label: string; refunds: number; amount: number }[];
    paidByMethod: { method: string; refunds: number; amount: number }[];
    paidByProduct: { sku: string; label: string; qty: number; amount: number; refunds: number }[];
    requestedInPeriod: { status: string; refunds: number; amount: number }[];
    open: { refundId: string; orderNumber: string; status: string; reason: string; amount: number; recordedOn: string }[];
  };
  definitions: Definitions;
}

// ── Website analytics ────────────────────────────────

export interface AnalyticsReport {
  success: true;
  range: ReportRange;
  summary: {
    visitors: number;
    pageViews: number;
    productViews: number;
    searches: number;
    addToCarts: number;
    checkoutStarts: number;
    ordersCompleted: number;
    abandonedCarts: number;
    abandonedCartValue: number;
    cartsConverted: number;
  };
  funnel: { step: string; visitors: number; percentOfViewers: number | null }[];
  topProducts: { product: string; views: number; visitors: number }[];
  topAddedToCart: { product: string; sku: string | null; adds: number }[];
  topSearches: { search: string; searches: number; zeroResults: number; avgResults: number }[];
  zeroResultSearches: { search: string; times: number }[];
  trafficSources: { source: string; visitors: number; ordered: number; orderPercent: number | null }[];
  definitions: Definitions;
}

// ── Risk ─────────────────────────────────────────────

export interface RiskReport {
  success: true;
  range: ReportRange;
  summary: {
    ordersPlaced: number;
    delivered: number;
    refused: number;
    cancelled: number;
    refusalPercent: number | null;
    cancellationPercent: number | null;
    highRiskThreshold: number;
  };
  byCity: { city: string; province: string; orders: number; delivered: number; refused: number; cancelled: number; refusalPercent: number | null }[];
  phones: { phone: string; name: string; orders: number; delivered: number; refused: number; cancelled: number; riskLevel: 'normal' | 'high' | 'blocked' }[];
  definitions: Definitions;
}

// ── Promotions ───────────────────────────────────────

export interface PromotionsReport {
  success: true;
  range: ReportRange;
  summary: {
    promotionsUsed: number;
    ordersWithPromotion: number;
    deliveredOrdersWithPromotion: number;
    shareOfDeliveredOrders: number | null;
    discountGiven: number;
    salesAfterDiscount: number;
  };
  promotions: {
    promotionId: string;
    name: string;
    type: string;
    code: string;
    status: string;
    orders: number;
    delivered: number;
    cancelled: number;
    returned: number;
    open: number;
    unitsDelivered: number;
    discountGiven: number;
    salesAfterDiscount: number;
  }[];
  definitions: Definitions;
}

// ── Calls ────────────────────────────────────────────

export type ReportName = 'sales' | 'profit' | 'inventory' | 'fulfillment' | 'cancellations' | 'analytics' | 'risk' | 'promotions';

// The same report as a spreadsheet file. A plain link works: the login cookie goes with it.
export function reportCsvUrl(name: ReportName, query: ReportRangeQuery & { groupBy?: SalesGroup } = {}): string {
  return `/api${withQuery(`/admin/reports/${name}`, { ...query, format: 'csv' })}`;
}

export const reportsApi = {
  sales: <Row = SalesDayRow>(query: ReportRangeQuery & { groupBy?: SalesGroup } = {}) =>
    api.get<SalesReport<Row>>(withQuery('/admin/reports/sales', query)),
  profit: (query: ReportRangeQuery = {}) => api.get<ProfitReport>(withQuery('/admin/reports/profit', query)),
  inventory: (query: ReportRangeQuery = {}) => api.get<InventoryReport>(withQuery('/admin/reports/inventory', query)),
  fulfillment: (query: ReportRangeQuery = {}) => api.get<FulfillmentReport>(withQuery('/admin/reports/fulfillment', query)),
  cancellations: (query: ReportRangeQuery = {}) => api.get<CancellationsReport>(withQuery('/admin/reports/cancellations', query)),
  analytics: (query: ReportRangeQuery = {}) => api.get<AnalyticsReport>(withQuery('/admin/reports/analytics', query)),
  risk: (query: ReportRangeQuery = {}) => api.get<RiskReport>(withQuery('/admin/reports/risk', query)),
  promotions: (query: ReportRangeQuery = {}) => api.get<PromotionsReport>(withQuery('/admin/reports/promotions', query)),
};
