import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { refundsApi, type RefundListQuery } from '../../../api/refunds';
import { CUSTOMERS_KEY } from '../customers/queries';
import { DASHBOARD_KEY } from '../dashboard/queries';
import { ORDERS_KEY } from '../orders/queries';

export const REFUNDS_KEY = ['refunds'] as const;

export function useRefundList(query: RefundListQuery, enabled = true) {
  return useQuery({
    queryKey: [...REFUNDS_KEY, 'list', query],
    queryFn: () => refundsApi.list(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRefund(id: string) {
  return useQuery({
    queryKey: [...REFUNDS_KEY, 'detail', id],
    queryFn: () => refundsApi.get(id),
  });
}

// A refund changes the order status, the payment, the customer's history and the dashboard tiles
export function useRefundMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const queryKey of [REFUNDS_KEY, ORDERS_KEY, DASHBOARD_KEY, CUSTOMERS_KEY]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}