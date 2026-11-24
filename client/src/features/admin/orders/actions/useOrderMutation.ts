import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DASHBOARD_KEY } from '../../dashboard/queries';
import { ORDERS_KEY } from '../queries';

// Runs an order action, then refreshes the order screen, the order list and the dashboard
export function useOrderMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}