import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAdminUser, getAdminUser, getAdminUsers, setAdminUserBlocked } from './adminUserApi';
import type { AdminUserListParams, CreateAdminUserPayload } from '../model/adminUserTypes';

export const adminUserKeys = {
  all: ['admin-users'] as const,
  list: (params: AdminUserListParams) => [...adminUserKeys.all, 'list', params] as const,
  detail: (id: string) => [...adminUserKeys.all, 'detail', id] as const,
};

export const useAdminUsersQuery = (params: AdminUserListParams) => useQuery({ queryKey: adminUserKeys.list(params), queryFn: ({ signal }) => getAdminUsers(params, signal), placeholderData: previous => previous });
export const useAdminUserQuery = (id: string | null) => useQuery({ queryKey: adminUserKeys.detail(id ?? ''), queryFn: ({ signal }) => getAdminUser(id!, signal), enabled: Boolean(id) });
export function useSetAdminUserBlockedMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: setAdminUserBlocked, onSuccess: () => client.invalidateQueries({ queryKey: adminUserKeys.all }) });
}

export function useCreateAdminUserMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAdminUserPayload) => createAdminUser(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}
