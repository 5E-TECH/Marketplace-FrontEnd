import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from './notificationApi';

const notificationKeys = { all: ['notifications'] as const };
const LIST = { page: 1, limit: 20 };

/** Oxirgi 20 ta bildirishnoma va o'qilmaganlar soni. Sahifa ochiq turganda minutiga bir yangilanadi. */
export const useNotificationsQuery = (enabled: boolean) => useQuery({
  queryKey: [...notificationKeys.all, LIST],
  queryFn: ({ signal }) => getNotifications(LIST, signal),
  enabled,
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
});

const useNotificationMutation = <T,>(mutationFn: (value: T) => Promise<void>) => {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }) });
};
export const useMarkNotificationReadMutation = () => useNotificationMutation(markNotificationRead);
export const useMarkAllNotificationsReadMutation = () => useNotificationMutation(markAllNotificationsRead);
