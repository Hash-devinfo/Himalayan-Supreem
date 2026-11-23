import { api, withQuery } from './client';
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

export type SalesGroup = 'day' | 'product' | 'variant' | 'category' | 'courier';

// groupBy=day: one row per day that had deliveries (days with none are missing)
export interface SalesDayRow {
  key: string; // YYYY-MM-DD
  label: string;
  orders: number;
  sales: number;
  deliveryCharges: number;
}

// groupBy=product: biggest sellers first
export interface SalesProductRow {
  productId: string;
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
}

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
}

export const reportsApi = {
  sales: <Row = SalesDayRow>(query: ReportRangeQuery & { groupBy?: SalesGroup } = {}) =>
    api.get<SalesReport<Row>>(withQuery('/admin/reports/sales', query)),
  fulfillment: (query: ReportRangeQuery = {}) =>
    api.get<FulfillmentReport>(withQuery('/admin/reports/fulfillment', query)),
};