import axios from 'axios';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { withOptionalParams } from '../../../shared/api/optionalParams';
import { readDto, readDtoList } from '../../../shared/api/readDto';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';
import type { WhereDeliver } from '../../operator/model/operatorTypes';
import type { CustomerRequestRow, OrderDetail, OrderExportColumn, OrderListPage, OrderListQuery, OrderRole, OrderStatus } from '../model/orderTypes';

/**
 * Buyurtmalar (BE-18). Admin va nazoratchi — `GET /admin/orders` (+ `{id}`), operator — taklif `GET /operator/orders`
 * (o'zi tasdiqlagan). Taklif parametrlari backend rad etsa — ularsiz (shared/api/optionalParams).
 */
const OPTIONAL = ['search', 'productId', 'affiliateId', 'regionSoato', 'whereDeliver', 'confirmedById', 'withCounts', 'sort'] as const;

export async function getOrders(role: OrderRole, query: OrderListQuery, signal?: AbortSignal): Promise<OrderListPage> {
  const { from, to, status, ...rest } = query;
  const { data } = await withOptionalParams(
    async (params) => readDto<OrderListPage>((await httpClient.get<unknown>(role === 'OPERATOR' ? '/operator/orders' : '/admin/orders', { params, signal })).data, ['items', 'total']),
    { ...rest, status, dateFrom: from, dateTo: to, source: rest.source, withCounts: true },
    OPTIONAL,
  );
  return data;
}

export async function getOrder(role: OrderRole, id: string, signal?: AbortSignal): Promise<OrderDetail> {
  const detailPath = role === 'OPERATOR' ? `/operator/orders/${encodeURIComponent(id)}` : `/admin/orders/${encodeURIComponent(id)}`;
  const { data } = await httpClient.get<unknown>(detailPath, { signal });
  return readDto<OrderDetail>(data, ['id', 'status', 'buyerName']);
}

/**
 * BUY-3: Elchi'ga topshirilgunga qadar, sabab bilan; band tovar darhol bo'shaydi. Admin — `/admin/orders`, operator va
 * nazoratchi — `/operator/orders` (backend ikkalasida nazoratchiga ruxsat). Topshirilgan — 409 INVALID_STATE.
 */
export async function cancelOrder({ role, id, reason }: { role: OrderRole; id: string; reason: string }): Promise<{ id: string; status: OrderStatus; idempotent: boolean }> {
  const cancelPath = role === 'ADMIN' ? `/admin/orders/${encodeURIComponent(id)}/cancel` : `/operator/orders/${encodeURIComponent(id)}/cancel`;
  const { data } = await httpClient.post<unknown>(cancelPath, { reason }, { timeout: REQUEST_TIMEOUT.action });
  return readDto<{ id: string; status: OrderStatus; idempotent: boolean }>(data, ['id', 'status']);
}

/**
 * Taklif: yorliqni qayta chop etish sababi — audit jurnaliga (admin-buyurtmalar «Sabab *»: kim, qachon, sabab). PDF o'zi —
 * mavjud `GET /admin/orders/{id}/label`. Backend endpointni hali bilmasa (404/405/501) chop etish to'xtamaydi.
 */
export async function logLabelReprint({ id, reason }: { id: string; reason: string }): Promise<void> {
  try {
    await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/label/reprints`, { reason }, { timeout: REQUEST_TIMEOUT.action });
  } catch (error) {
    if (!(axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status ?? 0))) throw error;
  }
}

/** Qaytarish so'rovini mijoz nomidan kiritish (faqat «Yetkazildi», EQ-10 muddati ichida). */
export async function recordReturn({ id, reason, comment, items }: { id: string; reason: string; comment?: string; items: Array<{ orderItemId?: string; productId: string; quantity: number }> }) {
  const { data } = await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/returns`, { items, reason, ...(comment ? { comment } : {}) }, { timeout: REQUEST_TIMEOUT.action });
  return unwrapApiData(data);
}

/** Taklif: qaytarish so'roviga mijoz rasmlari (multipart `files[]`, 3 tagacha, har biri ≤ 5 MB). */
export async function uploadReturnPhotos({ id, files }: { id: string; files: readonly File[] }) {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/returns/photos`, form, { timeout: REQUEST_TIMEOUT.file });
}

/** Taklif: nizoli deb belgilash — yozuvlar saqlanadi (admin-buyurtma-karta). */
export async function markDisputed({ id, reason }: { id: string; reason: string }) {
  await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/dispute`, { reason }, { timeout: REQUEST_TIMEOUT.action });
}

/** Taklif: Elchi'ga qayta yuborish — posilka yaratilmagan bo'lsa (Elchi API javob bermadi). */
export async function resendToElchi({ id }: { id: string }) {
  await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/elchi/resend`, undefined, { timeout: REQUEST_TIMEOUT.action });
}

/** Taklif: topshirilgunga qadar manzilni o'zgartirish (admin; nazoratchi — mijoz so'rovi bo'yicha). */
export async function changeOrderAddress({ id, regionSoato, districtSoato, addressLine, whereDeliver, reason }: { id: string; regionSoato: string; districtSoato: string; addressLine: string; whereDeliver: WhereDeliver; reason: string }) {
  const { data } = await httpClient.patch<unknown>(`/admin/orders/${encodeURIComponent(id)}/address`, { regionSoato, districtSoato, addressLine, whereDeliver, reason }, { timeout: REQUEST_TIMEOUT.action });
  return unwrapApiData(data);
}

/** Taklif: mijozga avtomatik SMS ni qo'lda qayta yuborish (qaysi biri — `template`); audit jurnaliga yoziladi. */
export async function resendSms({ id, template }: { id: string; template: string }) {
  await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/sms/resend`, { template }, { timeout: REQUEST_TIMEOUT.action });
}

/** Taklif: nizoni yopish — qo'ng'iroq yozuvi oddiy muddatga (90 kun) qaytadi. */
export async function closeDispute({ id, comment }: { id: string; comment?: string }) {
  await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/dispute/close`, comment ? { comment } : {}, { timeout: REQUEST_TIMEOUT.action });
}

/** Taklif: «Yo'lda» posilka holatini Elchi'dan so'rash (webhook kelmagan bo'lsa). */
export async function refreshFromElchi({ id }: { id: string }) {
  await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/elchi/refresh`, undefined, { timeout: REQUEST_TIMEOUT.action });
}

/** Taklif (47-qaror): mijoz so'rovlari — «Buyurtmam qayerda» sahifasidan bekor qilish yoki manzil. */
export async function getCustomerRequests(state: 'OPEN' | 'CLOSED', signal?: AbortSignal): Promise<CustomerRequestRow[]> {
  const { data } = await httpClient.get<unknown>('/supervisor/order-requests', { params: { state }, signal });
  return readDtoList<CustomerRequestRow>(data, ['id', 'kind', 'orderId']);
}

/** So'rovni bajarmasdan yopish: mijozga nima deyildi — buyurtma tarixiga va so'rovga yoziladi (taklif). */
export async function closeCustomerRequest({ id, comment }: { id: string; comment: string }) {
  await httpClient.post<unknown>(`/supervisor/order-requests/${encodeURIComponent(id)}/close`, { comment }, { timeout: REQUEST_TIMEOUT.action });
}

/** Taklif: CSV eksport (faqat admin) — fon ishi, tayyor bo'lganda bildirishnoma; har eksport audit jurnaliga. */
export async function exportOrders(input: { filters: Record<string, string>; columns: readonly OrderExportColumn[]; phone: 'LAST4' | 'FULL' }): Promise<{ id: string; rows: number }> {
  const { data } = await httpClient.post<unknown>('/admin/orders/export', input, { timeout: REQUEST_TIMEOUT.action });
  return readDto<{ id: string; rows: number }>(data, ['id', 'rows']);
}
