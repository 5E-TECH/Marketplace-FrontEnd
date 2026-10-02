import { useQuery } from '@tanstack/react-query';
import { getSellerOrders } from '../../orders/api/orderApi';
import type { SellerOrder } from '../../orders/model/orderTypes';
import { summarizeSellerOrders, type SellerOrdersSummary } from '../lib/summarizeSellerOrders';

const PAGE_LIMIT = 100;
/** Juda keng davrda so'rovlar cheksiz ko'paymasin: 50 sahifa (5000 buyurtma)dan keyin to'xtaydi. */
const MAX_PAGES = 50;

export interface SellerFinanceRange { dateFrom?: string; dateTo?: string }
export interface SellerFinanceSummary extends SellerOrdersSummary { truncated: boolean }

/** Davrdagi barcha buyurtmalar (sahifama-sahifa) — kartalar jadvalning joriy sahifasiga emas, butun davrga tayanadi. */
async function getAllSellerOrders(range: SellerFinanceRange, signal: AbortSignal): Promise<{ items: SellerOrder[]; truncated: boolean }> {
  const params = { ...(range.dateFrom ? { dateFrom: range.dateFrom } : {}), ...(range.dateTo ? { dateTo: range.dateTo } : {}), limit: PAGE_LIMIT };
  const first = await getSellerOrders({ ...params, page: 1 }, signal);
  const totalPages = Math.max(first.totalPages, Math.ceil(first.total / PAGE_LIMIT));
  const pages = Math.min(totalPages, MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => getSellerOrders({ ...params, page: index + 2 }, signal)));
  return { items: [first, ...rest].flatMap((page) => page.items), truncated: totalPages > MAX_PAGES };
}

export const useSellerFinanceSummaryQuery = (range: SellerFinanceRange) => useQuery({
  queryKey: ['seller-finance', 'summary', range],
  queryFn: async ({ signal }): Promise<SellerFinanceSummary> => {
    const { items, truncated } = await getAllSellerOrders(range, signal);
    return { ...summarizeSellerOrders(items), truncated };
  },
  placeholderData: (previous) => previous,
});
