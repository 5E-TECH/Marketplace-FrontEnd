import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../../shared/api/queryClient';
import {
  getSellerShop,
  updateSellerShop,
  type UpdateSellerShopPayload,
} from './sellerShopApi';

export const sellerShopQueryKey = ['seller', 'shop', 'me'] as const;

export function useSellerShopQuery(enabled = true) {
  return useQuery({
    queryKey: sellerShopQueryKey,
    queryFn: getSellerShop,
    staleTime: 5 * 60_000,
    retry: false,
    enabled,
  });
}

export function useUpdateSellerShopMutation() {
  return useMutation({
    mutationFn: (payload: UpdateSellerShopPayload) =>
      updateSellerShop(payload),
    onSuccess: (shop) => {
      queryClient.setQueryData(sellerShopQueryKey, shop);
    },
  });
}
