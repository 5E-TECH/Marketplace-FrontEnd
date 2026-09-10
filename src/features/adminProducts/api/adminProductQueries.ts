import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminProduct,
  getAdminProducts,
  reactivateAdminProduct,
  suspendAdminProduct,
} from './adminProductApi';
import type { AdminProductListParams } from '../model/adminProductTypes';

export const adminProductKeys = {
  all: ['admin-products'] as const,
  list: (params: AdminProductListParams) => ['admin-products', 'list', params] as const,
  detail: (productId: string) => ['admin-products', 'detail', productId] as const,
};

export function useAdminProductsQuery(params: AdminProductListParams) {
  return useQuery({
    queryKey: adminProductKeys.list(params),
    queryFn: ({ signal }) => getAdminProducts(params, signal),
    placeholderData: (previous) => previous,
  });
}

export function useAdminProductQuery(productId: string) {
  return useQuery({
    queryKey: adminProductKeys.detail(productId),
    queryFn: ({ signal }) => getAdminProduct(productId, signal),
    enabled: Boolean(productId),
  });
}

function useModerationMutation(mutationFn: (productId: string) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminProductKeys.all });
    },
  });
}

export const useSuspendAdminProductMutation = () => useModerationMutation(suspendAdminProduct);
export const useReactivateAdminProductMutation = () => useModerationMutation(reactivateAdminProduct);
