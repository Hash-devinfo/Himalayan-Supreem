import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryAdminApi, type CityListQuery } from '../../../api/delivery';

export const DELIVERY_KEY = ['delivery'] as const;

export function useZones() {
  return useQuery({ queryKey: [...DELIVERY_KEY, 'zones'], queryFn: deliveryAdminApi.zones });
}

export function useCityList(query: CityListQuery) {
  return useQuery({
    queryKey: [...DELIVERY_KEY, 'cities', query],
    queryFn: () => deliveryAdminApi.cities(query),
    placeholderData: keepPreviousData,
  });
}

// Zones and cities affect each other (city counts, zone names on cities), so both refresh
export function useDeliveryMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DELIVERY_KEY }),
  });
}