import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readNumber, readPagination, readText } from '../../../shared/api/responseFields';
import type { AdminPayout, AdminPayoutsPage, PayoutAction, PayoutListParams, PayoutStatus, ReportParams } from '../model/adminFinanceTypes';

const statuses: PayoutStatus[] = ['PENDING', 'APPROVED', 'HELD', 'PAID'];
function parsePayout(value: unknown): AdminPayout {
  if (!value || typeof value !== 'object') throw new Error('Payout ma’lumoti noto‘g‘ri formatda');
  const row = asRecord(value);
  const status = typeof row.status === 'string' ? row.status.toUpperCase() : '';
  if ((typeof row.id !== 'string' && typeof row.id !== 'number') || !statuses.includes(status as PayoutStatus)) throw new Error('Payoutning majburiy maydonlari mavjud emas');
  return { id: String(row.id), shopId: readText(row, 'shopId'), shopName: readText(row, 'shopName'), amount: readNumber(row, ['amount', 'netAmount', 'payoutAmount']), status: status as PayoutStatus, createdAt: readText(row, 'createdAt') };
}

export async function getAdminPayouts(params: PayoutListParams, signal?: AbortSignal): Promise<AdminPayoutsPage> {
  const { data } = await httpClient.get<unknown>('/admin/finance/payouts', { params, signal });
  const value = unwrapApiData(data); const record = asRecord(value);
  const rawItems = readItems(value, 'items');
  if (!rawItems) throw new Error('Payoutlar ro‘yxati noto‘g‘ri formatda');
  const items = rawItems.map(parsePayout);
  return { items, ...readPagination(record, { page: params.page, limit: params.limit, itemCount: items.length }) };
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
export async function getFinanceReport(kind: 'reports' | 'reconciliation', params: ReportParams, signal?: AbortSignal): Promise<unknown> {
  if (kind === 'reconciliation') {
    const { data } = await httpClient.get<unknown>('/admin/finance/reports/reconciliation', { params, signal });
    return unwrapApiData(data);
  }
  const { data } = await httpClient.get<unknown>('/admin/finance/reports', { params, signal });
  return unwrapApiData(data);
}
