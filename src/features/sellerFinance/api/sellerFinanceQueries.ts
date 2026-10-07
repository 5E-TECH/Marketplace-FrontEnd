import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPayoutSchedule, getSellerFinanceSummary, getSellerLedger, getSellerPayouts, updatePayoutSchedule } from './sellerFinanceApi';
import { summarizeLedger } from '../lib/summarizeLedger';
import type { FinancePage, SellerFinanceRange, SellerLedgerParams, SellerPayoutParams } from '../model/sellerFinanceTypes';

const PAGE_LIMIT = 100;
/** Juda keng davrda so'rovlar cheksiz ko'paymasin: 50 sahifa (5000 yozuv)dan keyin to'xtaydi. */
const MAX_PAGES = 50;

async function allPages<T>(load: (page: number) => Promise<FinancePage<T>>): Promise<{ items: T[]; truncated: boolean }> {
  const first = await load(1);
  const pages = Math.min(first.totalPages, MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => load(index + 2)));
  return { items: [first, ...rest].flatMap((page) => page.items), truncated: first.totalPages > MAX_PAGES };
}

const financeKeys = {
  all: ['seller-finance'] as const,
  summary: (range: SellerFinanceRange) => [...financeKeys.all, 'summary', range] as const,
  ledger: (params: SellerLedgerParams) => [...financeKeys.all, 'ledger', params] as const,
  payouts: (params: SellerPayoutParams) => [...financeKeys.all, 'payouts', params] as const,
  schedule: () => [...financeKeys.all, 'schedule'] as const,
  settlement: (range: SellerFinanceRange) => [...financeKeys.all, 'settlement', range] as const,
};

/**
 * Davr yig'indisi (jami tushum, komissiya, qaytarishlar) va har buyurtma bo'yicha hisob — davrdagi barcha
 * ledger yozuvlari va to'lovlardan (backend hisobi; frontend faqat yig'adi).
 */
export const useSellerSettlementQuery = (range: SellerFinanceRange) => useQuery({
  queryKey: financeKeys.settlement(range),
  queryFn: async ({ signal }) => {
    const [ledger, payouts] = await Promise.all([
      allPages((page) => getSellerLedger({ ...range, page, limit: PAGE_LIMIT }, signal)),
      allPages((page) => getSellerPayouts({ page, limit: PAGE_LIMIT }, signal)),
    ]);
    return { ...summarizeLedger(ledger.items, payouts.items), truncated: ledger.truncated || payouts.truncated };
  },
  placeholderData: (previous) => previous,
});

export const useSellerFinanceSummaryQuery = (range: SellerFinanceRange) => useQuery({
  queryKey: financeKeys.summary(range),
  queryFn: ({ signal }) => getSellerFinanceSummary(range, signal),
  placeholderData: (previous) => previous,
});

export const useSellerLedgerQuery = (params: SellerLedgerParams, enabled = true) => useQuery({
  queryKey: financeKeys.ledger(params),
  queryFn: ({ signal }) => getSellerLedger(params, signal),
  enabled,
  placeholderData: (previous) => previous,
});

export const useSellerPayoutsQuery = (params: SellerPayoutParams, enabled = true) => useQuery({
  queryKey: financeKeys.payouts(params),
  queryFn: ({ signal }) => getSellerPayouts(params, signal),
  enabled,
  placeholderData: (previous) => previous,
});

export const usePayoutScheduleQuery = () => useQuery({
  queryKey: financeKeys.schedule(),
  queryFn: ({ signal }) => getPayoutSchedule(signal),
});

export function useUpdatePayoutScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePayoutSchedule,
    onSuccess: async (schedule) => {
      queryClient.setQueryData(financeKeys.schedule(), schedule);
      // Jamlanmadagi `payoutSchedule` va `nextPayoutDate` ham o'zgaradi.
      await queryClient.invalidateQueries({ queryKey: [...financeKeys.all, 'summary'] });
    },
  });
}
