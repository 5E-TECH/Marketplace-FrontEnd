import axios, { type AxiosResponse } from 'axios';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readText } from '../../../shared/api/responseFields';

/** Kontrakt: ShippingLabelsBatchDto.orderIds — maxItems 100. */
const MAX_LABELS_PER_REQUEST = 100;

/**
 * `responseType: 'blob'` bo'lganda backendning JSON xatosi ham Blob bo'lib keladi —
 * umumiy xato ishlovchisi uni o'qiy olmaydi va "server bilan bog'lanib bo'lmadi"
 * deb chiqaradi. Blob'ni JSON'ga qaytaramiz.
 */
async function withReadableErrorBody(error: unknown): Promise<unknown> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try { error.response.data = JSON.parse(await error.response.data.text()) as unknown; }
    catch { /* JSON bo'lmasa asl xato qoladi. */ }
  }
  return error;
}

export type OrderLabelScope = 'seller' | 'admin';

/** PDF'ga kirmay qolgan yorliq: qaysi buyurtma/posilka va nega. */
export interface SkippedLabel { id: string | null; reason: string }
export interface LabelPrintResult { skipped: SkippedLabel[] }

/**
 * Kontrakt: partiyada yorlig'i chiqmagan buyurtmalar PDF'ni yiqitmaydi — ular
 * `X-Labels-Skipped` headerida URI-encoded JSON bo'lib, sababi bilan keladi.
 */
function parseSkippedLabels(header: unknown): SkippedLabel[] {
  if (typeof header !== 'string' || !header) return [];
  try {
    const value: unknown = JSON.parse(decodeURIComponent(header));
    const entries: unknown[] = Array.isArray(value)
      ? value
      : value && typeof value === 'object'
        ? Object.entries(value).map(([id, reason]) => (typeof reason === 'string' ? { id, reason } : { id, ...asRecord(reason) }))
        : [];
    return entries.slice(0, MAX_LABELS_PER_REQUEST).map((entry) => {
      if (typeof entry === 'string') return { id: null, reason: entry };
      const row = asRecord(entry);
      return {
        id: readText(row, 'orderId', 'salesOrderId', 'sellerOrderId', 'id') || null,
        reason: readText(row, 'reason', 'message', 'error') || 'Sabab ko‘rsatilmagan',
      };
    });
  } catch {
    return [];
  }
}

function requestLabel(scope: OrderLabelScope, orderIds: string[]): Promise<AxiosResponse<Blob>> {
  if (scope === 'admin') {
    return orderIds.length === 1
      ? httpClient.get<Blob>(`/admin/orders/${encodeURIComponent(orderIds[0])}/label`, { responseType: 'blob' })
      : httpClient.post<Blob>('/admin/orders/labels', { orderIds }, { responseType: 'blob' });
  }
  return orderIds.length === 1
    ? httpClient.get<Blob>(`/seller/orders/${encodeURIComponent(orderIds[0])}/label`, { responseType: 'blob' })
    : httpClient.post<Blob>('/seller/orders/labels', { orderIds }, { responseType: 'blob' });
}

/** PDF ko‘rish oynasi brauzer tomonidan bloklanmasligi uchun oynani klik paytida ochadi. */
async function openLabelPdf(request: () => Promise<AxiosResponse<Blob>>, fileName: string): Promise<LabelPrintResult> {
  const preview = window.open('about:blank', '_blank');
  if (preview) preview.opener = null;
  try {
    const response = await request();
    if (!(response.data instanceof Blob) || response.data.size === 0) throw new Error('Yorliq fayli bo‘sh qaytdi');
    const blob = response.data;
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'application/pdf' }));
    if (preview) preview.location.href = url;
    else {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { skipped: parseSkippedLabels(response.headers['x-labels-skipped']) };
  } catch (error) {
    preview?.close();
    throw await withReadableErrorBody(error);
  }
}

export async function openOrderLabels(scope: OrderLabelScope, orderIds: string[]): Promise<LabelPrintResult> {
  if (!orderIds.length) return { skipped: [] };
  if (orderIds.length > MAX_LABELS_PER_REQUEST) throw new Error(`Bir vaqtda ko‘pi bilan ${MAX_LABELS_PER_REQUEST} ta yorliq chop etiladi. ${orderIds.length} ta tanlangan.`);
  return openLabelPdf(
    () => requestLabel(scope, orderIds),
    orderIds.length === 1 ? `buyurtma-${orderIds[0]}-yorliq.pdf` : `buyurtmalar-${orderIds.length}-yorliq.pdf`,
  );
}

/** Admin: buyurtmaning bitta posilkasi (do‘koni) yorlig‘i — ko‘p do‘konli buyurtmada qayta chop etish uchun. */
export function openParcelLabel(orderId: string, sellerOrderId: string): Promise<LabelPrintResult> {
  return openLabelPdf(
    () => httpClient.get<Blob>(`/admin/orders/${encodeURIComponent(orderId)}/sellers/${encodeURIComponent(sellerOrderId)}/label`, { responseType: 'blob' }),
    `buyurtma-${orderId}-posilka-${sellerOrderId}-yorliq.pdf`,
  );
}

/** Chiqmay qolgan yorliqlar ro'yxati — foydalanuvchiga ko'rsatish uchun qisqa matn. */
export function formatSkippedLabels(skipped: SkippedLabel[]): string {
  const shown = skipped.slice(0, 5).map(({ id, reason }) => (id ? `#${id} — ${reason}` : reason)).join('; ');
  return skipped.length > 5 ? `${shown}; +${skipped.length - 5}` : shown;
}
