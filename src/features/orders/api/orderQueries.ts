import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelSellerOrder, confirmSellerOrder, createSellerShipment, getAdminOrder, getAdminOrders, getSellerOrder, getSellerOrderHistory, getSellerOrderItems, getSellerOrders, updateSellerOrderStatus } from './orderApi';
import type { AdminOrderListParams, CreateShipmentPayload, SellerOrderListParams } from '../model/orderTypes';

export const orderKeys = { all: ['seller-orders'] as const, list: (params: SellerOrderListParams) => [...orderKeys.all, params] as const };

export function useSellerOrdersQuery(params: SellerOrderListParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: ({ signal }) => getSellerOrders(params, signal),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateSellerOrderStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSellerOrderStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

export const useSellerOrderQuery = (id: string | null) => useQuery({ queryKey: [...orderKeys.all, 'detail', id], queryFn: ({ signal }) => getSellerOrder(id!, signal), enabled: Boolean(id) });
export const useSellerOrderItemsQuery = (id: string | null) => useQuery({ queryKey: [...orderKeys.all, 'items', id], queryFn: ({ signal }) => getSellerOrderItems(id!, signal), enabled: Boolean(id) });
export const useSellerOrderHistoryQuery = (id: string | null) => useQuery({ queryKey: [...orderKeys.all, 'history', id], queryFn: ({ signal }) => getSellerOrderHistory(id!, signal), enabled: Boolean(id) });
const useInvalidatingOrderMutation = <T,>(mutationFn: (value: T) => Promise<void>) => { const client = useQueryClient(); return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: orderKeys.all }) }); };
export const useConfirmSellerOrderMutation = () => useInvalidatingOrderMutation(confirmSellerOrder);
export const useCancelSellerOrderMutation = () => useInvalidatingOrderMutation(cancelSellerOrder);
export const useCreateSellerShipmentMutation = () => useInvalidatingOrderMutation<CreateShipmentPayload>(createSellerShipment);

export const adminOrderKeys = { all: ['admin-orders'] as const, list: (params: AdminOrderListParams) => ['admin-orders', params] as const, detail: (id: string) => ['admin-orders', 'detail', id] as const };
export const useAdminOrdersQuery = (params: AdminOrderListParams) => useQuery({ queryKey: adminOrderKeys.list(params), queryFn: ({ signal }) => getAdminOrders(params, signal), placeholderData: (previous) => previous });
export const useAdminOrderQuery = (id: string | null) => useQuery({ queryKey: adminOrderKeys.detail(id ?? ''), queryFn: ({ signal }) => getAdminOrder(id!, signal), enabled: Boolean(id) });
