import { keepPreviousData, useQuery } from '@tanstack/react-query';

export const REPORTS_KEY = ['reports'] as const;

// Reports only read data, so they share one simple hook
export function useReport<T>(name: string, params: object, fetcher: () => Promise<T>) {
  return useQuery({
    queryKey: [...REPORTS_KEY, name, params],
    queryFn: fetcher,
    placeholderData: keepPreviousData,
  });
}
