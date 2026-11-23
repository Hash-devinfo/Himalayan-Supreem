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

export interface SalesReport {
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
  sales: (query: ReportRangeQuery = {}) => api.get<SalesReport>(withQuery('/admin/reports/sales', query)),
  fulfillment: (query: ReportRangeQuery = {}) =>
    api.get<FulfillmentReport>(withQuery('/admin/reports/fulfillment', query)),
};