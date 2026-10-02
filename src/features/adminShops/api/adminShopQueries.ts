import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { activateAdminShop, approveAdminShop, getAdminShopDetail, getAdminShops, rejectAdminShop, setAdminShopFeatured, suspendAdminShop, updateAdminShopTariffs } from './adminShopApi';
import type { AdminShopDetail, AdminShopListParams } from '../model/adminShopTypes';

/** Moderatsiya dashboard'dagi "kutilmoqda" hisoblagichlariga ham ta'sir qiladi. */
const invalidateShopViews = (client: QueryClient) => Promise.all([
  client.invalidateQueries({ queryKey: adminShopKeys.all }),
  client.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
]);

const adminShopKeys = {
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
  return useMutation({ mutationFn: approveAdminShop, onSuccess: () => invalidateShopViews(client) });
}

export const useAdminShopDetailQuery = (id: string | null) => useQuery({ queryKey: adminShopKeys.detail(id ?? ''), queryFn: ({ signal }) => getAdminShopDetail(id as string, signal), enabled: Boolean(id) });

/**
 * Jadvaldagi do'kon ID'lari → nomi. Backend mahsulot/buyurtma qatorida faqat
 * `shopId` beradi; har do'kon bir marta so'raladi va keshdan qayta olinadi.
 * Nom hali kelmagan bo'lsa Map'da bo'lmaydi — chaqiruvchi `#id` ko'rsatadi.
 */
export function useAdminShopNames(ids: readonly string[]): ReadonlyMap<string, string> {
  // Sahifa har renderda yangi massiv beradi — ID'lar o'zgarmasa Map ham o'sha qolsin.
  const idsKey = [...new Set(ids.filter(Boolean))].join(',');
  const uniqueIds = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey]);
  const combine = useCallback(
    (results: UseQueryResult<AdminShopDetail>[]) =>
      new Map(results.flatMap(({ data }, index) => (data ? [[uniqueIds[index], data.name] as const] : []))),
    [uniqueIds],
  );
  return useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: adminShopKeys.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getAdminShopDetail(id, signal),
      staleTime: 5 * 60_000,
    })),
    combine,
  });
}

function useStatusMutation<T>(mutationFn: (variables: T) => Promise<void>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateShopViews(client) });
}

export const useRejectAdminShopMutation = () => useStatusMutation(rejectAdminShop);
export const useSuspendAdminShopMutation = () => useStatusMutation(suspendAdminShop);
export const useActivateAdminShopMutation = () => useStatusMutation(activateAdminShop);
export const useSetAdminShopFeaturedMutation = () => useStatusMutation(setAdminShopFeatured);
export const useUpdateAdminShopTariffsMutation = () => useStatusMutation(updateAdminShopTariffs);
