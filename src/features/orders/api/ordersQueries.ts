import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from '../../../shared/api/liveQuery';
import { adminLeadKeys } from '../../adminLeads/api/adminLeadsQueries';
import type { OrderListQuery, OrderRole } from '../model/orderTypes';
import { cancelOrder, changeOrderAddress, closeCustomerRequest, closeDispute, getCustomerRequests, getOrder, getOrders, logLabelReprint, markDisputed, recordReturn, refreshFromElchi, resendSms, resendToElchi } from './ordersApi';

export const orderKeys = {
  all: ['lead-orders'] as const,
  list: (role: OrderRole, query: OrderListQuery) => ['lead-orders', 'list', role, query] as const,
  card: (role: OrderRole, id: string) => ['lead-orders', 'card', role, id] as const,
  requests: (state: 'OPEN' | 'CLOSED') => ['lead-orders', 'requests', state] as const,
};

/** Buyurtmalar ro'yxati — «Har 60 soniyada yangilanadi» (admin-buyurtmalar). */
export const ORDERS_INTERVAL_MS = 60_000;

export function useOrdersQuery(role: OrderRole, query: OrderListQuery, enabled = true) {
  return useLiveQuery({
    queryKey: orderKeys.list(role, query),
    queryFn: ({ signal }) => getOrders(role, query, signal),
    placeholderData: keepPreviousData,
    intervalMs: ORDERS_INTERVAL_MS,
    enabled,
  });
}

export function useOrderQuery(role: OrderRole, id: string, enabled = true) {
  return useQuery({ queryKey: orderKeys.card(role, id), queryFn: ({ signal }) => getOrder(role, id, signal), enabled: enabled && Boolean(id) });
}

/** Bekor qilish (BUY-3): ro'yxat, karta va lid kartasi (buyurtma holati) yangilanadi. */
export function useCancelOrderMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: cancelOrder,
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: orderKeys.all }),
      client.invalidateQueries({ queryKey: adminLeadKeys.all }),
    ]),
  });
}

/** Yorliqni qayta chop etish sababi (audit): buyurtma kartasidagi «yorliq chop etilgan» yangilanadi. */
export function useLabelReprintMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: logLabelReprint, onSettled: () => client.invalidateQueries({ queryKey: orderKeys.all }) });
}

/** Buyurtma kartasi amallari: muvaffaqiyatdan keyin ro'yxat va karta (va lid kartasidagi buyurtma) yangilanadi. */
function useOrderAction<V>(mutationFn: (variables: V) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: orderKeys.all }),
      client.invalidateQueries({ queryKey: adminLeadKeys.all }),
    ]),
  });
}

export const useRecordReturnMutation = () => useOrderAction(recordReturn);
export const useDisputeMutation = () => useOrderAction(markDisputed);
export const useCloseDisputeMutation = () => useOrderAction(closeDispute);
export const useResendToElchiMutation = () => useOrderAction(resendToElchi);
export const useRefreshFromElchiMutation = () => useOrderAction(refreshFromElchi);
export const useChangeAddressMutation = () => useOrderAction(changeOrderAddress);
export const useResendSmsMutation = () => useOrderAction(resendSms);

/** Mijoz so'rovlari (nazoratchi, 47-qaror) — ro'yxat bilan birga 60 soniyada yangilanadi. */
export function useCustomerRequestsQuery(state: 'OPEN' | 'CLOSED') {
  return useLiveQuery({ queryKey: orderKeys.requests(state), queryFn: ({ signal }) => getCustomerRequests(state, signal), intervalMs: ORDERS_INTERVAL_MS });
}

export const useCloseRequestMutation = () => useOrderAction(closeCustomerRequest);
