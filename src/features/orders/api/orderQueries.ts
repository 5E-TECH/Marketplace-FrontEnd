import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelSellerOrder, confirmCheckout, confirmSellerOrder, createCheckout, createSellerShipment, getAdminOrder, getAdminOrders, getSellerOrder, getSellerOrderHistory, getSellerOrderItems, getSellerOrders, getSellerShipment, getSellerShipments, getSellerShipmentTracking, updateSellerOrderStatus } from './orderApi';
import type { AdminOrderListParams, ConfirmCheckoutPayload, CreateCheckoutPayload, SellerOrderListParams } from '../model/orderTypes';

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

export const useSellerOrderQuery = (id: string | null) => useQuery({ queryKey: [...orderKeys.all, 'detail', id], queryFn: ({ signal }) => getSellerOrder(id!, signal), enabled: Boolean(id) });
export const useSellerOrderItemsQuery = (id: string | null) => useQuery({ queryKey: [...orderKeys.all, 'items', id], queryFn: ({ signal }) => getSellerOrderItems(id!, signal), enabled: Boolean(id) });
export const useSellerOrderHistoryQuery = (id: string | null) => useQuery({ queryKey: [...orderKeys.all, 'history', id], queryFn: ({ signal }) => getSellerOrderHistory(id!, signal), enabled: Boolean(id) });
const useInvalidatingOrderMutation = <T,>(mutationFn: (value: T) => Promise<void>) => { const client = useQueryClient(); return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: orderKeys.all }) }); };
export const useConfirmSellerOrderMutation = () => useInvalidatingOrderMutation(confirmSellerOrder);
export const useCancelSellerOrderMutation = () => useInvalidatingOrderMutation(cancelSellerOrder);
export const useCreateSellerShipmentMutation = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: createSellerShipment, onSuccess: async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: orderKeys.all }),
      client.invalidateQueries({ queryKey: shipmentKeys.all }),
    ]);
  } });
};
export const useSellerShipmentQuery = (id: string | null) => useQuery({ queryKey: [...shipmentKeys.all, 'detail', id], queryFn: ({ signal }) => getSellerShipment(id!, signal), enabled: Boolean(id) });
export const useSellerShipmentTrackingQuery = (id: string | null) => useQuery({ queryKey: [...shipmentKeys.all, 'tracking', id], queryFn: ({ signal }) => getSellerShipmentTracking(id!, signal), enabled: Boolean(id) });
export const useCreateCheckoutMutation = () => useMutation({ mutationFn: (payload: CreateCheckoutPayload) => createCheckout(payload) });
export const useConfirmCheckoutMutation = () => useMutation({ mutationFn: (payload: ConfirmCheckoutPayload) => confirmCheckout(payload) });

export const adminOrderKeys = { all: ['admin-orders'] as const, list: (params: AdminOrderListParams) => ['admin-orders', params] as const, detail: (id: string) => ['admin-orders', 'detail', id] as const };
export const useAdminOrdersQuery = (params: AdminOrderListParams) => useQuery({ queryKey: adminOrderKeys.list(params), queryFn: ({ signal }) => getAdminOrders(params, signal), placeholderData: (previous) => previous });
export const useAdminOrderQuery = (id: string | null) => useQuery({ queryKey: adminOrderKeys.detail(id ?? ''), queryFn: ({ signal }) => getAdminOrder(id!, signal), enabled: Boolean(id) });
