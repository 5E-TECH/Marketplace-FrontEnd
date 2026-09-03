import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSellerOrders,
  getSellerShipments,
  updateSellerOrderStatus,
} from './orderApi';
import type { SellerOrderListParams } from '../model/orderTypes';

export const orderKeys = { all: ['seller-orders'] as const, list: (params: SellerOrderListParams) => [...orderKeys.all, params] as const };
export const shipmentKeys = { all: ['seller-shipments'] as const, list: (params: SellerOrderListParams) => [...shipmentKeys.all, params] as const };

export function useSellerOrdersQuery(params: SellerOrderListParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: ({ signal }) => getSellerOrders(params, signal),
    placeholderData: (previous) => previous,
  });
}

export function useSellerShipmentsQuery(params: SellerOrderListParams) {
  return useQuery({
    queryKey: shipmentKeys.list(params),
    queryFn: ({ signal }) => getSellerShipments(params, signal),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateSellerOrderStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSellerOrderStatus,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        queryClient.invalidateQueries({ queryKey: shipmentKeys.all }),
      ]);
    },
  });
}
