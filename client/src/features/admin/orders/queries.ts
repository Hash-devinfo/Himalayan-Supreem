import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ordersApi, type OrderListQuery, type OrderStatus } from '../../../api/orders';
import { reportsApi } from '../../../api/reports';
import { daysAgo, pktDateString } from '../../../lib/format';

// Everything about orders starts with this key; after an order changes we refresh it all
export const ORDERS_KEY = ['orders'] as const;

export function useOrderList(query: OrderListQuery) {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'list', query],
    queryFn: () => ordersApi.list(query),
    placeholderData: keepPreviousData, // keep showing the last page while the next one loads
    refetchInterval: 60_000,
  });
}

// Count per status for the filter chips (orders placed in the last 365 days, the longest range the report allows)
export function useOrderStatusCounts() {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'status-counts'],
    queryFn: async () => {
      const report = await reportsApi.fulfillment({ from: pktDateString(daysAgo(365)), to: pktDateString() });
      return Object.fromEntries(report.ordersByStatus.map((row) => [row.status, row.count])) as Partial<
        Record<OrderStatus, number>
      >;
    },
    refetchInterval: 60_000,
  });
}