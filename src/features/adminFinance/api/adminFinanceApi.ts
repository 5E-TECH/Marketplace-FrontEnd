import { httpClient } from '../../../shared/api/httpClient';
import { parseCodReport, parseLedgerPage, parsePayoutPage } from '../../sellerFinance/api/sellerFinanceApi';
import type { CodReconciliation, FinancePage, LedgerEntry } from '../../sellerFinance/model/sellerFinanceTypes';
import type { AdminPayoutsPage, LedgerListParams, PayoutAction, PayoutListParams, ReportParams } from '../model/adminFinanceTypes';

export async function getAdminPayouts(params: PayoutListParams, signal?: AbortSignal): Promise<AdminPayoutsPage> {
  const { data } = await httpClient.get<unknown>('/admin/finance/payouts', { params, signal });
  return parsePayoutPage(data);
}
export async function runPayoutAction({ id, action }: { id: string; action: PayoutAction }): Promise<void> {
  const payoutId = encodeURIComponent(id);
  if (action === 'approve') {
    await httpClient.post(`/admin/finance/payouts/${payoutId}/approve`);
  } else if (action === 'hold') {
    await httpClient.post(`/admin/finance/payouts/${payoutId}/hold`);
  } else {
    await httpClient.post(`/admin/finance/payouts/${payoutId}/release`);
  }
}
/** Barcha do'konlar (yoki `shopId`) ledger yozuvlari — sotuvchidagi `/seller/finance/ledger` bilan bir xil shakl. */
export async function getAdminLedger(params: LedgerListParams, signal?: AbortSignal): Promise<FinancePage<LedgerEntry>> {
  const { data } = await httpClient.get<unknown>('/admin/finance/ledger', { params, signal });
  return parseLedgerPage(data);
}
/** COD reconciliation va netting (`FinanceReconciliationReportDto`). `/admin/finance/reports` ham aynan shuni qaytaradi. */
export async function getFinanceReconciliation(params: ReportParams, signal?: AbortSignal): Promise<CodReconciliation> {
  const { data } = await httpClient.get<unknown>('/admin/finance/reports/reconciliation', { params, signal });
  return parseCodReport(data);
}
