import axios, { type AxiosResponse } from 'axios';
import { httpClient } from '../../../shared/api/httpClient';

export type OrderLabelScope = 'seller' | 'admin';

/** Partiyada chiqmay qolgan yorliq — backend `X-Labels-Skipped` headeri (C1.45). */
export interface SkippedOrderLabel {
  orderId: string;
  sellerOrderId?: string;
  reason: string;
}

export interface OrderLabelResult {
  skipped: SkippedOrderLabel[];
}

type LabelTarget =
  | { scope: OrderLabelScope; orderIds: string[] }
  /** Admin: buyurtmaning bitta do‘kon posilkasi. */
  | { scope: 'admin-parcel'; orderId: string; sellerOrderId: string };

const SKIPPED_HEADER = 'x-labels-skipped';

function sendLabelRequest(target: LabelTarget): Promise<AxiosResponse<Blob>> {
  const options = { responseType: 'blob' as const };
  if (target.scope === 'admin-parcel') {
    return httpClient.get<Blob>(`/admin/orders/${encodeURIComponent(target.orderId)}/sellers/${encodeURIComponent(target.sellerOrderId)}/label`, options);
  }
  // Yo‘llar literal: `npm run contract:check` ularni OpenAPI bilan solishtiradi.
  const { orderIds } = target;
  if (target.scope === 'admin') {
    // Admin id’lari — sales_order (ro‘yxat va tafsilot bilan bir xil); backend
    // har buyurtmaning barcha do‘kon posilkalarini chiqaradi.
    return orderIds.length === 1
      ? httpClient.get<Blob>(`/admin/orders/${encodeURIComponent(orderIds[0])}/label`, options)
      : httpClient.post<Blob>('/admin/orders/labels', { orderIds }, options);
  }
  return orderIds.length === 1
    ? httpClient.get<Blob>(`/seller/orders/${encodeURIComponent(orderIds[0])}/label`, options)
    : httpClient.post<Blob>('/seller/orders/labels', { orderIds }, options);
}

/**
 * `responseType: 'blob'` da xato javobi (JSON) ham Blob bo‘lib keladi va umumiy
 * xato ishlovchisi undan `message` ni o‘qiy olmaydi — admin "QR tokeni mavjud
 * emas" o‘rniga tushunarsiz umumiy xabarni ko‘rardi. JSON ni o‘sha axios
 * xatosining o‘ziga qaytaramiz: status va boshqa maydonlar saqlanadi.
 */
async function withReadableBody(error: unknown): Promise<unknown> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text()) as unknown;
    } catch {
      // JSON emas — umumiy xabar qoladi.
    }
  }
  return error;
}

function isSkipped(value: unknown): value is SkippedOrderLabel {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.orderId === 'string' && typeof record.reason === 'string';
}

function readSkipped(header: unknown): SkippedOrderLabel[] {
  if (typeof header !== 'string' || !header) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(header));
    return Array.isArray(parsed) ? parsed.filter(isSkipped) : [];
  } catch {
    return [];
  }
}

/** "QR tokeni mavjud emas: #7, #8; …" — sabab bo‘yicha guruhlangan qisqa matn. */
export function describeSkippedLabels(skipped: SkippedOrderLabel[]): string {
  const byReason = new Map<string, Set<string>>();
  for (const item of skipped) {
    const ids = byReason.get(item.reason) ?? new Set<string>();
    ids.add(`#${item.orderId}`);
    byReason.set(item.reason, ids);
  }
  return [...byReason].map(([reason, ids]) => `${reason}: ${[...ids].join(', ')}`).join('; ');
}

async function openLabel(target: LabelTarget, fileName: string): Promise<OrderLabelResult> {
  // PDF ko‘rish oynasi brauzer tomonidan bloklanmasligi uchun oyna klik paytida ochiladi.
  const preview = window.open('about:blank', '_blank');
  if (preview) preview.opener = null;
  try {
    const response = await sendLabelRequest(target).catch(async (error: unknown) => { throw await withReadableBody(error); });
    const blob = response.data;
    if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Yorliq fayli bo‘sh qaytdi');
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'application/pdf' }));
    if (preview) preview.location.href = url;
    else {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { skipped: readSkipped(response.headers?.[SKIPPED_HEADER]) };
  } catch (error) {
    preview?.close();
    throw error;
  }
}

export async function openOrderLabels(scope: OrderLabelScope, orderIds: string[]): Promise<OrderLabelResult> {
  if (!orderIds.length) return { skipped: [] };
  return openLabel(
    { scope, orderIds },
    orderIds.length === 1 ? `buyurtma-${orderIds[0]}-yorliq.pdf` : `buyurtmalar-${orderIds.length}-yorliq.pdf`,
  );
}

/** Admin: buyurtmaning bitta posilkasi (do‘koni) yorlig‘i. */
export async function openAdminParcelLabel(orderId: string, sellerOrderId: string): Promise<OrderLabelResult> {
  return openLabel({ scope: 'admin-parcel', orderId, sellerOrderId }, `buyurtma-${orderId}-${sellerOrderId}-yorliq.pdf`);
}
