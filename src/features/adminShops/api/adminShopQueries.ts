import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activateAdminShop, approveAdminShop, getAdminShopDetail, getAdminShops, rejectAdminShop, suspendAdminShop } from './adminShopApi';
import type { AdminShopListParams } from '../model/adminShopTypes';

export const adminShopKeys = {
  all: ['admin-shops'] as const,
  list: (params: AdminShopListParams) => ['admin-shops', params] as const,
  detail: (id: string) => ['admin-shops', 'detail', id] as const,
};

export const useAdminShopsQuery = (params: AdminShopListParams) => useQuery({
  queryKey: adminShopKeys.list(params),
  queryFn: ({ signal }) => getAdminShops(params, signal),
  placeholderData: (previous) => previous,
});

export function useApproveAdminShopMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: approveAdminShop, onSuccess: () => client.invalidateQueries({ queryKey: adminShopKeys.all }) });
}

export const useAdminShopDetailQuery = (id: string | null) => useQuery({ queryKey: adminShopKeys.detail(id ?? ''), queryFn: ({ signal }) => getAdminShopDetail(id as string, signal), enabled: Boolean(id) });

function useStatusMutation<T>(mutationFn: (variables: T) => Promise<void>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: adminShopKeys.all }) });
}

export const useRejectAdminShopMutation = () => useStatusMutation(rejectAdminShop);
export const useSuspendAdminShopMutation = () => useStatusMutation(suspendAdminShop);
export const useActivateAdminShopMutation = () => useStatusMutation(activateAdminShop);
