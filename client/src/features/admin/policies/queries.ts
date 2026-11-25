import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pagesAdminApi } from '../../../api/pages';

export const PAGES_KEY = ['policy-pages'] as const;

export function usePolicyPages() {
  return useQuery({ queryKey: [...PAGES_KEY, 'list'], queryFn: pagesAdminApi.list });
}

export function usePolicyPage(slug: string) {
  return useQuery({ queryKey: [...PAGES_KEY, 'detail', slug], queryFn: () => pagesAdminApi.get(slug) });
}

export function usePageMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PAGES_KEY }),
  });
}