import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { promotionsApi, type PromotionListQuery } from '../../../api/promotions';

export const PROMOTIONS_KEY = ['promotions'] as const;

export function usePromotionList(query: PromotionListQuery) {
  return useQuery({
    queryKey: [...PROMOTIONS_KEY, 'list', query],
    queryFn: () => promotionsApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function usePromotion(id: string | undefined) {
  return useQuery({
    queryKey: [...PROMOTIONS_KEY, 'detail', id],
    queryFn: () => promotionsApi.get(id!),
    enabled: Boolean(id),
  });
}

export function usePromotionMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PROMOTIONS_KEY }),
  });
}