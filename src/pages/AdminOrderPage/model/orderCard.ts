import type { OrderDetail } from '../../../features/orders/model/orderTypes';

/**
 * «Yo'lda» posilkadan Elchi webhooki shuncha vaqt kelmasa — ogohlantirish (admin-buyurtma-karta «Webhook kelmagan»).
 * Chegara TZ'da yo'q — taklif 48 soat (docs/api-taklif/fe-26-admin-lidlar-buyurtmalar.md); 2-bosqichda «Muammoli» ro'yxati.
 */
export const STALE_WEBHOOK_MS = 48 * 60 * 60_000;

export const isStale = (order: Pick<OrderDetail, 'status' | 'parcel' | 'updatedAt'>, now: number) =>
  order.status === 'IN_TRANSIT' && now - Date.parse(order.parcel?.lastWebhookAt ?? order.updatedAt) > STALE_WEBHOOK_MS;

/** «L-1183» — buyurtma lid raqami bilan ko'rinadi. */
export const orderLeadLabel = (order: Pick<OrderDetail, 'id' | 'lead'>) => order.lead?.leadId ?? order.id;
