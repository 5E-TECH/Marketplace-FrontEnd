import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSellerShop,
  getSellerShop,
  updateSellerShop,
  type CreateSellerShopPayload,
  type UpdateSellerShopPayload,
} from './sellerShopApi';

export const sellerShopQueryKey = ['seller', 'shop', 'me'] as const;

export function useSellerShopQuery(enabled = true) {
  return useQuery({
    queryKey: sellerShopQueryKey,
    queryFn: ({ signal }) => getSellerShop(signal),
    staleTime: 5 * 60_000,
    retry: false,
    enabled,
  });
}

export function useCreateSellerShopMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSellerShopPayload) => createSellerShop(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sellerShopQueryKey }),
  });
}

export function useUpdateSellerShopMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateSellerShopPayload) =>
      updateSellerShop(payload),
    onSuccess: (shop, payload) => {
      queryClient.setQueryData(sellerShopQueryKey, { ...shop, ...payload });
    },
  });
}
