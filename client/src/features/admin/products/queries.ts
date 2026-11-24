import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { categoriesAdminApi, productsAdminApi, type ProductListQuery } from '../../../api/catalog';

export const PRODUCTS_KEY = ['products'] as const;
export const CATEGORIES_KEY = ['categories'] as const;

export function useProductList(query: ProductListQuery) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, 'list', query],
    queryFn: () => productsAdminApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, 'detail', id],
    queryFn: () => productsAdminApi.get(id!),
    enabled: Boolean(id),
  });
}

// All categories, for filters and the product form (the list is short)
export function useCategories() {
  return useQuery({
    queryKey: [...CATEGORIES_KEY, 'all'],
    queryFn: () => categoriesAdminApi.list(),
    staleTime: 5 * 60_000,
  });
}