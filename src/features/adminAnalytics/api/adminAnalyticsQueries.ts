import { useQuery } from '@tanstack/react-query';
import { getAdminShops } from '../../adminShops/api/adminShopApi';
import { getAdminOrder, getAdminOrders } from '../../orders/api/orderApi';
import type { AdminOrder } from '../../orders/model/orderTypes';
import {
  isRealized, previousRange, rankProducts, rankShops, salesByDay, salesTotals,
  type ProductSales, type SalesDay, type SalesRange, type SalesTotals, type ShopSales,
} from '../lib/salesAnalytics';

const PAGE_LIMIT = 100;
/** Juda keng davrda so'rovlar cheksiz ko'paymasin: 50 sahifa (5000 buyurtma)dan keyin to'xtaydi. */
const MAX_PAGES = 50;
/**
 * Reyting buyurtma tafsilotidan hisoblanadi (ro'yxatda do'kon va mahsulot yo'q). Backend tayyor
 * hisobot bermaguncha eng so'nggi 200 ta buyurtma bilan cheklanadi — bu holat sahifada aytiladi.
 */
const DETAIL_LIMIT = 200;
const DETAIL_CONCURRENCY = 6;
const TOP_SIZE = 5;

export interface AdminSales {
  totals: SalesTotals;
  previous: SalesTotals;
  days: SalesDay[];
  /** Reyting uchun — savdo deb hisoblangan buyurtmalar, eng yangisidan. */
  orderIds: string[];
  truncated: boolean;
}
export interface AdminTopSales { shops: Array<ShopSales & { name: string }>; products: ProductSales[]; partial: boolean }

async function getAllAdminOrders(range: SalesRange, signal: AbortSignal): Promise<{ items: AdminOrder[]; truncated: boolean }> {
  const first = await getAdminOrders({ ...range, page: 1, limit: PAGE_LIMIT }, signal);
  const totalPages = Math.max(first.totalPages, Math.ceil(first.total / PAGE_LIMIT));
  const pages = Math.min(totalPages, MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => getAdminOrders({ ...range, page: index + 2, limit: PAGE_LIMIT }, signal)));
  return { items: [first, ...rest].flatMap((page) => page.items), truncated: totalPages > MAX_PAGES };
}

/** Bir vaqtda ko'pi bilan `limit` ta so'rov — backendni yuzlab parallel so'rov bilan bosmaslik uchun. */
async function mapWithLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const analyticsKeys = {
  sales: (range: SalesRange) => ['admin-analytics', 'sales', range] as const,
  top: (orderIds: string[]) => ['admin-analytics', 'top', orderIds] as const,
};

/** Davr ko'rsatkichlari va kunlik grafik: davrdagi barcha buyurtmalar + solishtirish uchun oldingi davr. */
export const useAdminSalesQuery = (range: SalesRange) => useQuery({
  queryKey: analyticsKeys.sales(range),
  queryFn: async ({ signal }): Promise<AdminSales> => {
    const [current, previous] = await Promise.all([getAllAdminOrders(range, signal), getAllAdminOrders(previousRange(range), signal)]);
    const realized = current.items.filter(isRealized).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return {
      totals: salesTotals(realized),
      previous: salesTotals(previous.items.filter(isRealized)),
      days: salesByDay(realized, range),
      orderIds: realized.map((order) => order.id),
      truncated: current.truncated || previous.truncated,
    };
  },
  placeholderData: (previous) => previous,
});

/** Eng ko'p sotilgan do'kon va mahsulotlar — davrdagi savdo buyurtmalari tafsilotidan. */
export const useAdminTopSalesQuery = (orderIds: string[] | undefined) => useQuery({
  queryKey: analyticsKeys.top(orderIds ?? []),
  enabled: Boolean(orderIds?.length),
  queryFn: async ({ signal }): Promise<AdminTopSales> => {
    const ids = (orderIds ?? []).slice(0, DETAIL_LIMIT);
    const [details, shops] = await Promise.all([
      mapWithLimit(ids, DETAIL_CONCURRENCY, (id) => getAdminOrder(id, signal)),
      getAdminShops({ page: 1, limit: PAGE_LIMIT }, signal),
    ]);
    const names = new Map(shops.items.map((shop) => [shop.id, shop.name]));
    return {
      shops: rankShops(details).slice(0, TOP_SIZE).map((shop) => ({ ...shop, name: names.get(shop.shopId) ?? `#${shop.shopId}` })),
      products: rankProducts(details).slice(0, TOP_SIZE),
      partial: (orderIds?.length ?? 0) > DETAIL_LIMIT,
    };
  },
  placeholderData: (previous) => previous,
});
