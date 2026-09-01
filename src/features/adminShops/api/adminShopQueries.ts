import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveAdminShop, getAdminShops } from './adminShopApi';
import type { AdminShopListParams } from '../model/adminShopTypes';

export const adminShopKeys = {
  all: ['admin-shops'] as const,
  list: (params: AdminShopListParams) => ['admin-shops', params] as const,
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
