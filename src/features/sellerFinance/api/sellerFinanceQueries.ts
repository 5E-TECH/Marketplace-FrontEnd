import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPayoutSchedule, getSellerFinanceSummary, getSellerLedger, getSellerPayouts, updatePayoutSchedule } from './sellerFinanceApi';
import type { SellerFinanceRange, SellerLedgerParams, SellerPayoutParams } from '../model/sellerFinanceTypes';

const financeKeys = {
  all: ['seller-finance'] as const,
  summary: (range: SellerFinanceRange) => [...financeKeys.all, 'summary', range] as const,
  ledger: (params: SellerLedgerParams) => [...financeKeys.all, 'ledger', params] as const,
  payouts: (params: SellerPayoutParams) => [...financeKeys.all, 'payouts', params] as const,
  schedule: () => [...financeKeys.all, 'schedule'] as const,
};

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
