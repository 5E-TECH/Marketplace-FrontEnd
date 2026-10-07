import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminLedger, getAdminPayouts, getFinanceReconciliation, runPayoutAction } from './adminFinanceApi';
import type { LedgerListParams, PayoutListParams, ReportParams } from '../model/adminFinanceTypes';
const financeKeys = { all: ['admin-finance'] as const, payouts: (params: PayoutListParams) => [...financeKeys.all, 'payouts', params] as const, ledger: (params: LedgerListParams) => [...financeKeys.all, 'ledger', params] as const, reconciliation: (params: ReportParams) => [...financeKeys.all, 'reconciliation', params] as const };
export const useAdminPayoutsQuery = (params: PayoutListParams, enabled = true) => useQuery({ queryKey: financeKeys.payouts(params), queryFn: ({ signal }) => getAdminPayouts(params, signal), enabled, placeholderData: previous => previous });
export const useAdminLedgerQuery = (params: LedgerListParams, enabled = true) => useQuery({ queryKey: financeKeys.ledger(params), queryFn: ({ signal }) => getAdminLedger(params, signal), enabled, placeholderData: previous => previous });
export const useFinanceReconciliationQuery = (params: ReportParams, enabled = true) => useQuery({ queryKey: financeKeys.reconciliation(params), queryFn: ({ signal }) => getFinanceReconciliation(params, signal), enabled });
export function usePayoutActionMutation() { const client = useQueryClient(); return useMutation({ mutationFn: runPayoutAction, onSuccess: () => client.invalidateQueries({ queryKey: financeKeys.all }) }); }
