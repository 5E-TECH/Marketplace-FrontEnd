import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelSellerOrder, confirmSellerOrder, createSellerShipment, getAdminOrder, getAdminOrders, getSellerOrder, getSellerOrderHistory, getSellerOrderItems, getSellerOrders, getSellerShipment, getSellerShipments, getSellerShipmentTracking, updateSellerOrderStatus } from './orderApi';
import type { AdminOrderListParams, AdminOrderStatus, SellerOrderListParams } from '../model/orderTypes';

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
const useInvalidatingOrderMutation = <T,>(mutationFn: (value: T) => Promise<void>) => { const client = useQueryClient(); return useMutation({ mutationFn, onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: orderKeys.all }), client.invalidateQueries({ queryKey: shipmentKeys.all })]) }); };
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
export const adminOrderKeys = { all: ['admin-orders'] as const, list: (params: AdminOrderListParams) => ['admin-orders', params] as const, detail: (id: string) => ['admin-orders', 'detail', id] as const };
export const useAdminOrdersQuery = (params: AdminOrderListParams) => useQuery({ queryKey: adminOrderKeys.list(params), queryFn: ({ signal }) => getAdminOrders(params, signal), placeholderData: (previous) => previous });

const ADMIN_ORDER_BATCH_SIZE = 100;

async function getAllAdminOrders(
  params: Omit<AdminOrderListParams, 'page' | 'limit'>,
  signal: AbortSignal,
) {
  const firstPage = await getAdminOrders(
    { ...params, page: 1, limit: ADMIN_ORDER_BATCH_SIZE },
    signal,
  );
  const totalPages = Math.max(
    firstPage.totalPages,
    Math.ceil(firstPage.total / ADMIN_ORDER_BATCH_SIZE),
  );

  if (totalPages <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      getAdminOrders(
        { ...params, page: index + 2, limit: ADMIN_ORDER_BATCH_SIZE },
        signal,
      ),
    ),
  );

  return {
    ...firstPage,
    items: [firstPage, ...remainingPages].flatMap((page) => page.items),
  };
}

function matchesAdminOrderSearch(order: Awaited<ReturnType<typeof getAdminOrders>>['items'][number], search: string) {
  const searchable = [
    order.id,
    order.orderNumber,
    order.buyerName,
    order.buyerPhone,
    order.shopName,
  ].filter(Boolean).join(' ').toLocaleLowerCase();

  return searchable.includes(search);
}

/**
 * Admin API bitta so‘rovda faqat bitta status qabul qiladi. UI'dagi ko‘p
 * tanlovni to‘liq saqlash uchun har bir status alohida olinadi, vaqt bo‘yicha
 * birlashtiriladi va shundan keyin umumiy sahifalanadi.
 */
export function useAdminOrdersByStatusesQuery(
  params: Omit<AdminOrderListParams, 'status'>,
  statuses: readonly AdminOrderStatus[],
  search = '',
) {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const requestedStatuses: Array<AdminOrderStatus | undefined> = statuses.length
    ? [...statuses]
    : [undefined];
  const loadsAllOrders = requestedStatuses.length > 1 || Boolean(normalizedSearch);

  return useQueries({
    queries: requestedStatuses.map((status) => {
      const queryParams: AdminOrderListParams = {
        ...params,
        page: loadsAllOrders ? 1 : params.page,
        limit: loadsAllOrders ? ADMIN_ORDER_BATCH_SIZE : params.limit,
        ...(status ? { status } : {}),
      };
      return {
        queryKey: adminOrderKeys.list(queryParams),
        queryFn: ({ signal }: { signal: AbortSignal }) => loadsAllOrders
          ? getAllAdminOrders(queryParams, signal)
          : getAdminOrders(queryParams, signal),
        placeholderData: (previous: Awaited<ReturnType<typeof getAdminOrders>> | undefined) => previous,
      };
    }),
    combine: (results) => {
      const pages = results.map((result) => result.data).filter((page) => page !== undefined);
      const allLoaded = pages.length === results.length;
      const mergedItems = pages
        .flatMap((page) => page.items)
        .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
      const filteredItems = normalizedSearch
        ? mergedItems.filter((order) => matchesAdminOrderSearch(order, normalizedSearch))
        : mergedItems;
      const total = normalizedSearch
        ? filteredItems.length
        : pages.reduce((sum, page) => sum + page.total, 0);
      const offset = loadsAllOrders ? (params.page - 1) * params.limit : 0;
      return {
        data: allLoaded ? {
          items: loadsAllOrders ? filteredItems.slice(offset, offset + params.limit) : filteredItems,
          total,
          page: params.page,
          limit: params.limit,
          totalPages: Math.max(1, Math.ceil(total / params.limit)),
        } : undefined,
        isPending: results.some((result) => result.isPending),
        isFetching: results.some((result) => result.isFetching),
        isError: results.some((result) => result.isError),
        error: results.find((result) => result.error)?.error,
        refetch: () => Promise.all(results.map((result) => result.refetch())),
      };
    },
  });
}
export const useAdminOrderQuery = (id: string | null) => useQuery({ queryKey: adminOrderKeys.detail(id ?? ''), queryFn: ({ signal }) => getAdminOrder(id!, signal), enabled: Boolean(id) });
