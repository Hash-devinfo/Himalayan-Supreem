import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, type CustomerFilter } from '../../../api/customers';
import { DASHBOARD_KEY } from '../dashboard/queries';
import { ORDERS_KEY } from '../orders/queries';

export const CUSTOMERS_KEY = ['customers'] as const;

export function useCustomerList(query: { search?: string; filter?: CustomerFilter; page: number; limit: number }) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, 'list', query],
    queryFn: () => customersApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(phone: string) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, 'detail', phone],
    queryFn: () => customersApi.get(phone),
  });
}

// Blocking changes risk badges on orders and the dashboard too
export function useCustomerMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY });
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}