import type { components } from '../../../generated/api-types';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { readDto, readDtoList } from '../../../shared/api/readDto';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';
import type { LeadCard, LeadPrice, LeadProductInfo, LeadResultAccepted, LeadResultInput, OperatorAttemptsPage, OperatorLeadListItem, OperatorQueueSummary, OperatorStateInfo, WhereDeliver } from '../model/operatorTypes';

/** Operator navbati API (BE-13, BE-25 shartnomasi). Tiplar — generatsiya qilingan DTO'lar. */
type Schemas = components['schemas'];
export type OperatorState = Schemas['OperatorStateDto']['state'];
export type { OperatorStateInfo };
export type OperatorLead = OperatorLeadListItem;
export type OperatorStats = Schemas['OperatorStatsDto'];

const LEAD_CARD_KEYS = ['id', 'status', 'customerName', 'product', 'address', 'attempts', 'history', 'previousLeads'] as const;

/**
 * Joriy holat. Taklif (BE-13): `GET /operator/state` — sahifa yangilanganda holat
 * «Oflayn» dan boshlanmasin va bronlar soni serverdan kelsin.
 */
export async function getOperatorState(signal?: AbortSignal): Promise<OperatorStateInfo> {
  const { data } = await httpClient.get<unknown>('/operator/state', { signal });
  return readDto<OperatorStateInfo>(data, ['state', 'activeBookings', 'maxBookings']);
}

export async function updateOperatorState(state: OperatorState): Promise<OperatorStateInfo> {
  const { data } = await httpClient.put<unknown>('/operator/state', { state }, { timeout: REQUEST_TIMEOUT.action });
  return readDto<OperatorStateInfo>(data, ['state', 'activeBookings', 'maxBookings']);
}

/** Mening bronlarim va rejalashtirilgan qo'ng'iroqlarim. */
export async function getOperatorLeads(signal?: AbortSignal): Promise<OperatorLead[]> {
  const { data } = await httpClient.get<unknown>('/operator/leads', { signal });
  return readDtoList<OperatorLead>(data, ['id', 'status', 'customerName', 'productName']);
}

/** «Keyingi lid» (F2): navbat boshidagi lid 10 daqiqaga shu operatorga bron qilinadi. */
export async function takeNextLead(): Promise<LeadCard> {
  const { data } = await httpClient.post<unknown>('/operator/leads/next', undefined, { timeout: REQUEST_TIMEOUT.action });
  return readDto<LeadCard>(data, [...LEAD_CARD_KEYS]);
}

export async function getLeadCard(id: string, signal?: AbortSignal): Promise<LeadCard> {
  const { data } = await httpClient.get<unknown>(`/operator/leads/${encodeURIComponent(id)}`, { signal });
  return readDto<LeadCard>(data, [...LEAD_CARD_KEYS]);
}

export async function submitLeadResult(id: string, input: LeadResultInput): Promise<LeadResultAccepted> {
  const { data } = await httpClient.post<unknown>(`/operator/leads/${encodeURIComponent(id)}/result`, input, { timeout: REQUEST_TIMEOUT.action });
  return readDto<LeadResultAccepted>(data, ['leadId', 'status', 'nextAttemptAt']);
}

export type LeadAddressInput = Schemas['UpdateLeadAddressDto'];

/**
 * Manzilni tasdiqlash yoki tuzatish (BE-38, OPR-4): saqlash — tasdiq; tuzatilgan maydonning eski va yangi
 * qiymati lid tarixiga yoziladi. Javob — yangilangan lid kartasi.
 */
export async function confirmLeadAddress(id: string, address: LeadAddressInput): Promise<LeadCard> {
  const { data } = await httpClient.patch<unknown>(`/operator/leads/${encodeURIComponent(id)}/address`, address, { timeout: REQUEST_TIMEOUT.action });
  return readDto<LeadCard>(data, [...LEAD_CARD_KEYS]);
}

/**
 * Miqdor va yetkazish turi bo'yicha summa — ekran o'zi hisoblamaydi (BE-09: yetkazish jami og'irlikka qarab).
 * Backend narxni hisoblay olmasa `null` qaytaradi — mijozga summa aytilmaydi.
 */
export async function quoteLeadPrice(id: string, quantity: number, whereDeliver: WhereDeliver, signal?: AbortSignal): Promise<LeadPrice | null> {
  const body: Schemas['LeadPriceQuoteDto'] = { quantity, whereDeliver };
  const { data } = await httpClient.post<unknown>(`/operator/leads/${encodeURIComponent(id)}/quote`, body, { timeout: REQUEST_TIMEOUT.action, signal });
  const payload = unwrapApiData(data);
  return payload === null || payload === undefined || payload === '' ? null : readDto<LeadPrice>(payload, ['subtotal', 'deliveryFee', 'totalAmount']);
}

/** Taklif (BE-13): «Bugungi urinishlarim · oxirgi 10 tasi». */
export async function getOperatorAttempts(from: string, to: string, limit: number, signal?: AbortSignal): Promise<OperatorAttemptsPage> {
  const { data } = await httpClient.get<unknown>('/operator/attempts', { params: { from, to, limit }, signal });
  return readDto<OperatorAttemptsPage>(data, ['items', 'total']);
}

/** «Navbatda: 14 ta lid — 6 qayta qo'ng'iroq, 8 yangi lid». */
export async function getQueueSummary(signal?: AbortSignal): Promise<OperatorQueueSummary> {
  const { data } = await httpClient.get<unknown>('/operator/queue-summary', { signal });
  return readDto<OperatorQueueSummary>(data, ['newLeads', 'dueCallbacks', 'booked']);
}

/** Taklif (BE-13 / OPT-2): «Mahsulot ma'lumoti» paneli. */
export async function getLeadProduct(id: string, signal?: AbortSignal): Promise<LeadProductInfo> {
  const { data } = await httpClient.get<unknown>(`/operator/leads/${encodeURIComponent(id)}/product`, { signal });
  return readDto<LeadProductInfo>(data, ['id', 'name', 'available', 'salePrice', 'deliveryFee']);
}

export async function getOperatorStats(from: string, to: string, signal?: AbortSignal): Promise<OperatorStats> {
  const { data } = await httpClient.get<unknown>('/operator/stats', { params: { from, to }, signal });
  return readDto<OperatorStats>(data, ['attempts', 'confirmed']);
}
