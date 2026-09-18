import { httpClient } from '../../../shared/api/httpClient';

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
    throw error;
  }
}
