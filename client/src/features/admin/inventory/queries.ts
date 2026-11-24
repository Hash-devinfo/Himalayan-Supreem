import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { batchesApi, inventoryApi, type MovementsQuery } from '../../../api/inventory';
import { DASHBOARD_KEY } from '../dashboard/queries';
import { PRODUCTS_KEY } from '../products/queries';

export const INVENTORY_KEY = ['inventory'] as const;

export function useBatches(productId: string, variantId: string) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'batches', variantId],
    queryFn: () => batchesApi.list(productId, variantId),
  });
}

export function useMovements(query: MovementsQuery) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'movements', query],
    queryFn: () => inventoryApi.movements(query),
    placeholderData: keepPreviousData,
  });
}

// Any stock change: refresh batches, movements, the product's sizes and the dashboard alerts
export function useStockMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}