import axios from 'axios';
import { httpClient } from '../../../shared/api/httpClient';

/** Kontrakt: ShippingLabelsBatchDto.orderIds — maxItems 100. */
export const MAX_LABELS_PER_REQUEST = 100;

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

async function requestLabel(scope: OrderLabelScope, orderIds: string[]): Promise<Blob> {
  const response = scope === 'admin'
    ? orderIds.length === 1
      ? await httpClient.get<Blob>(`/admin/orders/${encodeURIComponent(orderIds[0])}/label`, { responseType: 'blob' })
      : await httpClient.post<Blob>('/admin/orders/labels', { orderIds }, { responseType: 'blob' })
    : orderIds.length === 1
      ? await httpClient.get<Blob>(`/seller/orders/${encodeURIComponent(orderIds[0])}/label`, { responseType: 'blob' })
      : await httpClient.post<Blob>('/seller/orders/labels', { orderIds }, { responseType: 'blob' });
  if (!(response.data instanceof Blob) || response.data.size === 0) throw new Error('Yorliq fayli bo‘sh qaytdi');
  return response.data;
}

/** PDF ko‘rish oynasi brauzer tomonidan bloklanmasligi uchun oynani klik paytida ochadi. */
export async function openOrderLabels(scope: OrderLabelScope, orderIds: string[]): Promise<void> {
  if (!orderIds.length) return;
  if (orderIds.length > MAX_LABELS_PER_REQUEST) throw new Error(`Bir vaqtda ko‘pi bilan ${MAX_LABELS_PER_REQUEST} ta yorliq chop etiladi. ${orderIds.length} ta tanlangan.`);
  const preview = window.open('about:blank', '_blank');
  if (preview) preview.opener = null;
  try {
    const blob = await requestLabel(scope, orderIds);
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'application/pdf' }));
    if (preview) preview.location.href = url;
    else {
      const link = document.createElement('a');
      link.href = url;
      link.download = orderIds.length === 1 ? `buyurtma-${orderIds[0]}-yorliq.pdf` : `buyurtmalar-${orderIds.length}-yorliq.pdf`;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    preview?.close();
    throw await withReadableErrorBody(error);
  }
}
