import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi, type SettingsUpdate } from '../../../api/settings';
import { DASHBOARD_KEY } from '../dashboard/queries';
import { INVENTORY_KEY } from '../inventory/queries';
import { PRODUCTS_KEY } from '../products/queries';

export const SETTINGS_KEY = ['settings'] as const;

export function useSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: settingsApi.get });
}

// Stock rules change what counts as sellable, so stock screens refresh too
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SettingsUpdate) => settingsApi.update(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}