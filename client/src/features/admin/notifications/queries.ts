import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type NotificationListQuery } from '../../../api/notifications';

export const NOTIFICATIONS_KEY = ['notifications'] as const;

export function useTemplates() {
  return useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'templates'], queryFn: notificationsApi.templates });
}

export function useNotificationLog(query: NotificationListQuery) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'log', query],
    queryFn: () => notificationsApi.log(query),
    placeholderData: keepPreviousData,
  });
}

export function useWhatsappOptions(orderNumber: string) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'whatsapp', orderNumber],
    queryFn: () => notificationsApi.whatsappOptions(orderNumber),
  });
}

export function useNotificationMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}