import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBroadcasts, getNotificationTemplates, previewBroadcast, resetNotificationTemplate, sendBroadcast, updateNotificationTemplate } from './adminNotificationApi';

export const adminNotificationKeys = {
  templates: ['admin-notifications', 'templates'] as const,
  broadcasts: (page: number) => ['admin-notifications', 'broadcasts', page] as const,
  broadcastsAll: ['admin-notifications', 'broadcasts'] as const,
};

export const useNotificationTemplatesQuery = () => useQuery({
  queryKey: adminNotificationKeys.templates,
  queryFn: ({ signal }) => getNotificationTemplates(signal),
});

function useTemplateMutation<T>(mutationFn: (variables: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: adminNotificationKeys.templates }) });
}
export const useUpdateTemplateMutation = () => useTemplateMutation(updateNotificationTemplate);
export const useResetTemplateMutation = () => useTemplateMutation(resetNotificationTemplate);

export const usePreviewBroadcastMutation = () => useMutation({ mutationFn: previewBroadcast });

export function useSendBroadcastMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: sendBroadcast, onSuccess: () => client.invalidateQueries({ queryKey: adminNotificationKeys.broadcastsAll }) });
}

/** Yuborilayotgan xabar bo‘lsa holati har 3 soniyada yangilanadi. */
export const useBroadcastsQuery = (page: number) => useQuery({
  queryKey: adminNotificationKeys.broadcasts(page),
  queryFn: ({ signal }) => getBroadcasts({ page, limit: 10 }, signal),
  placeholderData: (previous) => previous,
  refetchInterval: (query) => query.state.data?.items.some((item) => item.status === 'QUEUED' || item.status === 'SENDING') ? 3000 : false,
});
