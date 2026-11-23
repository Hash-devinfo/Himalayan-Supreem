import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../../../api/inventory';
import { ordersApi, type OrderStatus } from '../../../api/orders';
import { refundsApi } from '../../../api/refunds';
import { reportsApi } from '../../../api/reports';
import { reviewsAdminApi } from '../../../api/reviews';
import { daysAgo, pktDateString } from '../../../lib/format';

const TWO_MINUTES = 120_000;

// Everything on the dashboard starts with this key, so "Refresh" reloads all of it at once
export const DASHBOARD_KEY = ['dashboard'] as const;

// Orders waiting at each step. Counts orders placed in the last 365 days (the longest range the report allows).
export function useOrderPipeline() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'pipeline'],
    queryFn: async () => {
      const [report, cancellationRequests] = await Promise.all([
        reportsApi.fulfillment({ from: pktDateString(daysAgo(365)), to: pktDateString() }),
        ordersApi.list({ flag: 'cancellationRequested', limit: 1 }),
      ]);
      const count = (status: OrderStatus) => report.ordersByStatus.find((r) => r.status === status)?.count ?? 0;

      return {
        newOrders: count('new'),
        retryCalls: count('contact_attempt_1') + count('contact_attempt_2') + count('contact_attempt_3'),
        lastTry: count('contact_attempt_3'),
        toPack: count('confirmed'),
        toShip: count('packing'),
        cancellationRequests: cancellationRequests.total,
        codHeldAmount: report.summary.codHeldAmount,
        codHeldOrders: report.summary.codHeldOrders,
      };
    },
    refetchInterval: TWO_MINUTES,
  });
}

export function useSalesStats() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'sales'],
    queryFn: async () => {
      const today = pktDateString();
      const [last30Days, todayOnly] = await Promise.all([
        reportsApi.sales(),
        reportsApi.sales({ from: today, to: today }),
      ]);
      return {
        range: last30Days.range,
        summary: last30Days.summary,
        placedLast30Days: last30Days.placed.total,
        placedToday: todayOnly.placed.total,
      };
    },
  });
}

export function useStockAlerts() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'stock'],
    queryFn: async () => {
      const [expiry, lowStock] = await Promise.all([inventoryApi.expiryAlerts(60), inventoryApi.lowStockAlerts()]);
      return { ...expiry, lowStock: lowStock.items };
    },
  });
}

export function useRecentOrders() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'recent-orders'],
    queryFn: () => ordersApi.list({ limit: 6 }),
    refetchInterval: TWO_MINUTES,
  });
}

export function useModerationCounts() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'moderation'],
    queryFn: async () => {
      const [reviews, requested, approved] = await Promise.all([
        reviewsAdminApi.list({ status: 'pending', limit: 1 }),
        refundsApi.list({ status: 'requested', limit: 1 }),
        refundsApi.list({ status: 'approved', limit: 1 }),
      ]);
      return {
        pendingReviews: reviews.counts.pending,
        refundsToReview: requested.total,
        refundsToPay: approved.total,
      };
    },
  });
}