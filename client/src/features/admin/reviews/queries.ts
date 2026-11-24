import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsAdminApi, type ModerationStatus, type ReviewListQuery } from '../../../api/reviews';
import { DASHBOARD_KEY } from '../dashboard/queries';
import { PRODUCTS_KEY } from '../products/queries';

export const REVIEWS_KEY = ['reviews'] as const;

export function useReviewList(query: ReviewListQuery) {
  return useQuery({
    queryKey: [...REVIEWS_KEY, 'list', query],
    queryFn: () => reviewsAdminApi.list(query),
    placeholderData: keepPreviousData,
  });
}

// Moderating changes the tab counts, the dashboard tile and the product's star rating
export function useModerateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: ModerationStatus; note?: string }) =>
      reviewsAdminApi.moderate(vars.id, vars.status, vars.note),
    onSuccess: () => {
      for (const queryKey of [REVIEWS_KEY, DASHBOARD_KEY, PRODUCTS_KEY]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}