import { httpClient } from '../../../shared/api/httpClient';
import type { SellerOrder, SellerOrderListParams, SellerOrdersPage, SellerOrderStatus, UpdateSellerOrderStatusPayload } from '../model/orderTypes';

const statuses: SellerOrderStatus[] = ['NEW', 'CONFIRMED', 'PENDING', 'SHIPMENT_CREATED', 'ON_THE_ROAD', 'DELIVERED', 'CANCELLED', 'RETURNED'];

function unwrap(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'data' in value ? value.data : value;
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Buyurtmaning ${key} maydoni noto‘g‘ri`);
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function parseOrder(value: unknown): SellerOrder {
  if (typeof value !== 'object' || value === null) throw new Error('Buyurtma noto‘g‘ri formatda keldi');
  const order = value as Record<string, unknown>;
  if (typeof order.id !== 'string' || typeof order.salesOrderId !== 'string' || typeof order.createdAt !== 'string') throw new Error('Buyurtmaning majburiy maydonlari yo‘q');
  if (typeof order.status !== 'string' || !statuses.includes(order.status as SellerOrderStatus)) throw new Error('Buyurtma statusi noto‘g‘ri');
  return {
    id: order.id,
    salesOrderId: order.salesOrderId,
    buyerName: nullableString(order.buyerName),
    subtotal: numberField(order, 'subtotal'),
    codAmount: numberField(order, 'codAmount'),
    status: order.status as SellerOrderStatus,
    elchiShipmentId: nullableString(order.elchiShipmentId),
    trackingUrl: nullableString(order.trackingUrl),
    itemsCount: numberField(order, 'itemsCount'),
    createdAt: order.createdAt,
  };
}

export async function getSellerOrders(params: SellerOrderListParams, signal?: AbortSignal): Promise<SellerOrdersPage> {
  const { data } = await httpClient.get<unknown>('/seller/orders', { signal, params });
  const value = unwrap(data);
  if (typeof value !== 'object' || value === null || !('items' in value) || !Array.isArray(value.items)) throw new Error('Buyurtmalar ro‘yxati noto‘g‘ri formatda');
  const page = value as Record<string, unknown>;
  return {
    items: value.items.map(parseOrder),
    total: numberField(page, 'total'),
    page: numberField(page, 'page'),
    limit: numberField(page, 'limit'),
    totalPages: numberField(page, 'totalPages'),
  };
}

export async function updateSellerOrderStatus({ id, status }: UpdateSellerOrderStatusPayload): Promise<void> {
  await httpClient.patch(`/seller/orders/${encodeURIComponent(id)}`, { status });
}
