import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminPayouts, getFinanceReport, runPayoutAction } from './adminFinanceApi';
import type { PayoutListParams, ReportParams } from '../model/adminFinanceTypes';
export const financeKeys = { all: ['admin-finance'] as const, payouts: (params: PayoutListParams) => [...financeKeys.all, 'payouts', params] as const, report: (kind: string, params: ReportParams) => [...financeKeys.all, kind, params] as const };
export const useAdminPayoutsQuery = (params: PayoutListParams, enabled = true) => useQuery({ queryKey: financeKeys.payouts(params), queryFn: ({ signal }) => getAdminPayouts(params, signal), enabled, placeholderData: previous => previous });
export const useFinanceReportQuery = (kind: 'reports' | 'reconciliation', params: ReportParams, enabled = true) => useQuery({ queryKey: financeKeys.report(kind, params), queryFn: ({ signal }) => getFinanceReport(kind, params, signal), enabled });
export function usePayoutActionMutation() { const client = useQueryClient(); return useMutation({ mutationFn: runPayoutAction, onSuccess: () => client.invalidateQueries({ queryKey: financeKeys.all }) }); }
