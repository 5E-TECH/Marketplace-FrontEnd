import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, deleteUser, getUsers, updateUser } from './userApi';
import type { ManagedUser, UpdateUserPayload, UserListParams, UserPage, UserUpsertPayload } from '../model/userTypes';

export const userKeys = { all: ['seller-operators'] as const };

function selectUserPage(users: ManagedUser[], params: UserListParams): UserPage {
  const normalizedSearch = params.search?.trim().toLocaleLowerCase('uz') ?? '';
  const filtered = users.filter((user) => {
    const matchesSearch = !normalizedSearch || `${user.name} ${user.phone}`.toLocaleLowerCase('uz').includes(normalizedSearch);
    const matchesStatus = params.isActive === undefined || user.isActive === params.isActive;
    return matchesSearch && matchesStatus;
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const start = (page - 1) * params.limit;
  return { items: filtered.slice(start, start + params.limit), total, page, limit: params.limit, totalPages };
}

export const useUsersQuery = (params: UserListParams) => useQuery({
  queryKey: userKeys.all,
  queryFn: ({ signal }) => getUsers(signal),
  select: (users) => selectUserPage(users, params),
});
export function useCreateUserMutation() { const client = useQueryClient(); return useMutation({ mutationFn: (payload: UserUpsertPayload) => createUser(payload), onSuccess: () => client.invalidateQueries({ queryKey: userKeys.all }) }); }
export function useDeleteUserMutation() { const client = useQueryClient(); return useMutation({ mutationFn: deleteUser, onSuccess: () => client.invalidateQueries({ queryKey: userKeys.all }) }); }
export function useUpdateUserMutation() { const client = useQueryClient(); return useMutation({ mutationFn: (payload: UpdateUserPayload) => updateUser(payload), onSuccess: () => client.invalidateQueries({ queryKey: userKeys.all }) }); }
