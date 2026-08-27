import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, deleteUser, getUsers, updateUser } from './userApi';
import type { UpdateUserPayload, UserListParams, UserUpsertPayload } from '../model/userTypes';

export const userKeys = { all: ['seller-operators'] as const, list: (params: UserListParams) => ['seller-operators', params] as const };
export const useUsersQuery = (params: UserListParams) => useQuery({ queryKey: userKeys.list(params), queryFn: ({ signal }) => getUsers(params, signal), placeholderData: (previous) => previous });
export function useCreateUserMutation() { const client = useQueryClient(); return useMutation({ mutationFn: (payload: UserUpsertPayload) => createUser(payload), onSuccess: () => client.invalidateQueries({ queryKey: userKeys.all }) }); }
export function useDeleteUserMutation() { const client = useQueryClient(); return useMutation({ mutationFn: deleteUser, onSuccess: () => client.invalidateQueries({ queryKey: userKeys.all }) }); }
export function useUpdateUserMutation() { const client = useQueryClient(); return useMutation({ mutationFn: (payload: UpdateUserPayload) => updateUser(payload), onSuccess: () => client.invalidateQueries({ queryKey: userKeys.all }) }); }
