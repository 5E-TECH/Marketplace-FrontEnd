import axios from 'axios';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { withOptionalParams } from '../../../shared/api/optionalParams';
import { readDto, readDtoList } from '../../../shared/api/readDto';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';
import { getAdminProducts } from '../../adminProducts/api/adminProductsApi';
import { getQueueSummary } from '../../operator/api/operatorApi';
import {
  LEAD_TAB_STATUSES,
  type AdminLeadCard,
  type AdminLeadQuery,
  type AdminLeadsPage,
  type LeadExportColumn,
  type LeadFilterOptions,
  type OperatorActivity,
  type TransferOperator,
} from '../model/adminLeadTypes';

/** Taklif parametrlari (backendda hali yo'q): tab, qidiruv, manba, saralash. */
const OPTIONAL = ['tab', 'search', 'source', 'sort'] as const;

/**
 * Lidlar ro'yxati (BE-42: telefon niqoblangan). Backend `tab` ni bilmasa — joriy sahifa tab holatlari bo'yicha
 * filtrlanadi (sonlar taklif `counts` dan).
 */
export async function getAdminLeads(query: AdminLeadQuery, signal?: AbortSignal): Promise<AdminLeadsPage> {
  const { tab, ...rest } = query;
  // Bitta holatli tab (Tasdiqlandi, Rad etildi) backend `status` filtri bilan ham ishlaydi.
  const single = tab && tab !== 'ALL' && tab !== 'REVIEW' && LEAD_TAB_STATUSES[tab].length === 1 ? LEAD_TAB_STATUSES[tab][0] : undefined;
  const { data, dropped } = await withOptionalParams(
    async (params) => readDto<AdminLeadsPage>((await httpClient.get<unknown>('/admin/leads', { params, signal })).data, ['items', 'total']),
    { ...rest, status: rest.status ?? single, tab: tab && tab !== 'ALL' ? tab : undefined },
    OPTIONAL,
  );
  if (!dropped.includes('tab') || !tab || tab === 'ALL' || tab === 'REVIEW') return data;
  const statuses: readonly string[] = LEAD_TAB_STATUSES[tab];
  const items = data.items.filter((item) => statuses.includes(item.status));
  return { ...data, items, total: items.length };
}

export async function getAdminLead(id: string, signal?: AbortSignal): Promise<AdminLeadCard> {
  const { data } = await httpClient.get<unknown>(`/admin/leads/${encodeURIComponent(id)}`, { signal });
  return readDto<AdminLeadCard>(data, ['id', 'status', 'customerName', 'history']);
}

/**
 * «Rad etildi» lidni qayta ochish (BE-35) — faqat admin, sabab majburiy. Lid navbatga yangi lid bo'lib qaytadi
 * (urinishlar 0); shu raqam va mahsulotda faol lid bo'lsa — 409 `ACTIVE_LEAD_EXISTS`.
 */
export async function reopenLead({ id, reason }: { id: string; reason: string }) {
  const { data } = await httpClient.post<unknown>(`/admin/leads/${encodeURIComponent(id)}/reopen`, { reason }, { timeout: REQUEST_TIMEOUT.action });
  return unwrapApiData(data);
}

/**
 * Boshqa operatorga o'tkazish (BE-42, nazoratchi va admin): faqat «Ishda» operatorga, lid uning broniga tushadi
 * (5 ta chegara). Taklif: vaqti kelmagan rejalashtirilgan qo'ng'iroq yangi operatorda shu vaqt bilan qoladi.
 */
export async function transferLead({ id, operatorId, reason }: { id: string; operatorId: string; reason?: string }) {
  const { data } = await httpClient.post<unknown>(`/supervisor/leads/${encodeURIComponent(id)}/transfer`, { operatorId, ...(reason ? { reason } : {}) }, { timeout: REQUEST_TIMEOUT.action });
  return unwrapApiData(data);
}

/** Taklif: bronni bo'shatish — lid navbatga qaytadi (admin-lid-karta «Bronni bo'shatish»; 9-savol). */
export async function releaseBooking({ id, reason }: { id: string; reason: string }) {
  await httpClient.post<unknown>(`/admin/leads/${encodeURIComponent(id)}/release`, { reason }, { timeout: REQUEST_TIMEOUT.action });
}

const statusIn = (error: unknown, codes: readonly number[]) => axios.isAxiosError(error) && codes.includes(error.response?.status ?? 0);
const notAvailable = (error: unknown) => statusIn(error, [403, 404, 405]);
const options = (rows: Array<{ id: string; name: string }>) => rows.filter((row) => row.id && row.name).sort((a, b) => a.name.localeCompare(b.name, 'uz'));

/**
 * Filtr variantlari. Taklif `GET /admin/leads/filter-options` (admin va nazoratchi); backend bermasa — mavjud
 * ro'yxatlar: operatorlar `queue-summary` dan, mahsulot va sotuvchilar faqat adminga (`/admin/products`, `/admin/users`).
 */
export async function getLeadFilterOptions(admin: boolean, signal?: AbortSignal): Promise<LeadFilterOptions> {
  try {
    const { data } = await httpClient.get<unknown>('/admin/leads/filter-options', { signal });
    const value = readDto<LeadFilterOptions>(data, ['operators']);
    return { products: options(value.products ?? []), operators: options(value.operators ?? []), affiliates: options(value.affiliates ?? []) };
  } catch (error) {
    // Backendda hali yo'q: `/admin/leads/{id}` ga tushib 400 («leadId noto'g'ri») yoki 404 qaytadi.
    if (!statusIn(error, [400, 403, 404, 405])) throw error;
  }
  const safe = async <T>(promise: Promise<T[]>): Promise<T[]> => {
    try {
      return await promise;
    } catch (error) {
      if (notAvailable(error)) return [];
      throw error;
    }
  };
  const [operators, products, affiliates] = await Promise.all([
    safe(getQueueSummary(signal).then((summary) => summary.operators.map((item) => ({ id: item.operatorId, name: item.name })))),
    admin ? safe(getAdminProducts({ tab: 'ALL', search: '', page: 1, limit: 100 }, signal).then((page) => page.items.map((item) => ({ id: item.id, name: item.name })))) : Promise.resolve([]),
    admin ? safe(getAffiliates(signal)) : Promise.resolve([]),
  ]);
  return { products: options(products), operators: options(operators), affiliates: options(affiliates) };
}

const DEFAULT_MAX_BOOKINGS = 5;

/** Sotuvchilar (`GET /admin/users?role=AFFILIATE`, BE-05 rollari) — faqat id va ism. */
async function getAffiliates(signal?: AbortSignal): Promise<Array<{ id: string; name: string }>> {
  const { data } = await httpClient.get<unknown>('/admin/users', { params: { role: 'AFFILIATE', page: 1, limit: 100 }, signal });
  const value = unwrapApiData(data) as { items?: unknown };
  return readDtoList<{ id: string; name: string }>(value.items ?? value, ['id']).map((item) => ({ id: String(item.id), name: item.name || item.id }));
}

type QueueOperatorDto = { operatorId: string; name: string; state: TransferOperator['state']; activeBookings: number; maxBookings?: number; scheduledCalls?: number | null; activity?: OperatorActivity | null };

/** O'tkazish oynasi operatorlari: `queue-summary` (BE-13) + taklif maydonlari; bo'lmasa — chegara 5, faoliyat yo'q. */
export async function getTransferOperators(signal?: AbortSignal): Promise<TransferOperator[]> {
  const summary = await getQueueSummary(signal);
  return (summary.operators as QueueOperatorDto[]).map((item) => ({
    id: item.operatorId,
    name: item.name,
    state: item.state,
    activeBookings: item.activeBookings,
    maxBookings: item.maxBookings ?? DEFAULT_MAX_BOOKINGS,
    scheduledCalls: item.scheduledCalls ?? null,
    activity: item.activity ?? null,
  }));
}


/** Taklif: CSV eksport (faqat admin) — fon ishi, tayyor bo'lganda bildirishnoma keladi; har eksport audit jurnaliga. */
export async function exportLeads(input: { filters: Record<string, string>; columns: readonly LeadExportColumn[]; phone: 'LAST4' | 'FULL' }): Promise<{ id: string; rows: number }> {
  const { data } = await httpClient.post<unknown>('/admin/leads/export', input, { timeout: REQUEST_TIMEOUT.action });
  return readDto<{ id: string; rows: number }>(data, ['id', 'rows']);
}
