import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminStock } from '../../adminInventory/api/adminInventoryApi';
import type { AdminProduct, OfferContent } from '../model/adminProductTypes';
import {
  approveProduct,
  changeAffiliateFee,
  confirmCreative,
  deleteCreative,
  getAdminProduct,
  getAdminProducts,
  getAllAdminProducts,
  getCreatives,
  getModerationSummary,
  getOfferContent,
  getPriceDecisions,
  getProductAudit,
  getProductPricing,
  getWholesalerOptions,
  hideProduct,
  reactivateProduct,
  rejectProduct,
  saveOfferContent,
  updateProduct,
  type AdminProductsParams,
} from './adminProductsApi';

/** Kalitlar bitta joyda: qaror va tahrirdan keyin ro'yxat, kartochka va hisoblagichlar birga yangilanadi. */
export const adminProductKeys = {
  all: ['admin', 'products'] as const,
  list: (params: AdminProductsParams) => ['admin', 'products', 'list', params] as const,
  everything: ['admin', 'products', 'list', 'all'] as const,
  summary: ['admin', 'products', 'summary'] as const,
  product: (id: string) => ['admin', 'products', 'item', id] as const,
  pricing: (id: string, query: { price?: number; affiliateFee?: number } = {}) => ['admin', 'products', 'item', id, 'pricing', query] as const,
  decisions: (id: string) => ['admin', 'products', 'item', id, 'decisions'] as const,
  creatives: (id: string) => ['admin', 'products', 'item', id, 'creatives'] as const,
  content: (id: string) => ['admin', 'products', 'item', id, 'content'] as const,
  audit: (id: string) => ['admin', 'products', 'item', id, 'audit'] as const,
};

/** Hamma mahsulot (sahifalab) — kategoriyalar sahifasi. */
export const useAllAdminProductsQuery = () => useQuery({ queryKey: adminProductKeys.everything, queryFn: ({ signal }) => getAllAdminProducts(signal) });

export function useAdminProductsQuery(params: AdminProductsParams, options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: adminProductKeys.list(params),
    queryFn: ({ signal }) => getAdminProducts(params, signal),
    placeholderData: keepPreviousData,
    refetchInterval: options.refetchInterval,
  });
}

/** Optoviklar kamdan-kam o'zgaradi — filtr ochilganda har safar so'ralmaydi. */
export function useWholesalerOptionsQuery() {
  return useQuery({ queryKey: ['admin', 'wholesalers', 'options'], queryFn: ({ signal }) => getWholesalerOptions(signal), staleTime: 5 * 60_000 });
}

export function useModerationSummaryQuery(options: { refetchInterval?: number } = {}) {
  return useQuery({ queryKey: adminProductKeys.summary, queryFn: ({ signal }) => getModerationSummary(signal), refetchInterval: options.refetchInterval });
}

export function useAdminProductQuery(id: string | undefined) {
  return useQuery({ queryKey: adminProductKeys.product(id ?? ''), queryFn: ({ signal }) => getAdminProduct(id ?? '', signal), enabled: Boolean(id) });
}

export function useProductPricingQuery(id: string | undefined, query: { price?: number; affiliateFee?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: adminProductKeys.pricing(id ?? '', query),
    queryFn: ({ signal }) => getProductPricing({ id: id ?? '', ...query }, signal),
    enabled: Boolean(id) && enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function usePriceDecisionsQuery(id: string | undefined) {
  return useQuery({ queryKey: adminProductKeys.decisions(id ?? ''), queryFn: ({ signal }) => getPriceDecisions(id ?? '', signal), enabled: Boolean(id) });
}

/** Mahsulot qoldig'i omborlar bo'yicha (`/admin/inventory/stock?productId=`). */
export function useProductStockQuery(id: string | undefined) {
  return useQuery({
    queryKey: [...adminProductKeys.product(id ?? ''), 'stock'],
    queryFn: ({ signal }) => getAdminStock({ page: 1, limit: 50, productId: id }, signal),
    enabled: Boolean(id),
  });
}

export function useCreativesQuery(id: string | undefined) {
  return useQuery({ queryKey: adminProductKeys.creatives(id ?? ''), queryFn: ({ signal }) => getCreatives(id ?? '', signal), enabled: Boolean(id) });
}

export function useOfferContentQuery(id: string | undefined) {
  return useQuery({ queryKey: adminProductKeys.content(id ?? ''), queryFn: ({ signal }) => getOfferContent(id ?? '', signal), enabled: Boolean(id) });
}

export function useProductAuditQuery(id: string | undefined) {
  return useQuery({ queryKey: adminProductKeys.audit(id ?? ''), queryFn: ({ signal }) => getProductAudit(id ?? '', signal), enabled: Boolean(id), retry: false });
}

/** Mahsulot o'zgarsa: kartochka javobdan darhol, ro'yxatlar va hisoblagichlar qayta so'raladi. */
function useProductMutation<T>(mutationFn: (value: T) => Promise<AdminProduct>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (product) => {
      client.setQueryData(adminProductKeys.product(product.id), (previous: AdminProduct | undefined) => ({ ...previous, ...product }));
      return client.invalidateQueries({ queryKey: adminProductKeys.all });
    },
  });
}

export const useApproveProductMutation = () => useProductMutation(approveProduct);
export const useRejectProductMutation = () => useProductMutation(rejectProduct);
export const useHideProductMutation = () => useProductMutation(hideProduct);
export const useReactivateProductMutation = () => useProductMutation(reactivateProduct);
export const useUpdateProductMutation = () => useProductMutation(updateProduct);

export function useChangeAffiliateFeeMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: changeAffiliateFee,
    onSuccess: (_, { id }) => Promise.all([
      client.invalidateQueries({ queryKey: adminProductKeys.product(id) }),
      client.invalidateQueries({ queryKey: adminProductKeys.all }),
    ]),
  });
}

export function useSaveOfferContentMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveOfferContent,
    onSuccess: (content) => client.setQueryData<OfferContent>(adminProductKeys.content(content.productId), content),
  });
}

export function useConfirmCreativeMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: confirmCreative,
    onSuccess: (_, { productId }) => client.invalidateQueries({ queryKey: adminProductKeys.product(productId) }),
  });
}

export function useDeleteCreativeMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteCreative,
    onSuccess: (_, { productId }) => client.invalidateQueries({ queryKey: adminProductKeys.product(productId) }),
  });
}
