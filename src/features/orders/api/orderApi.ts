import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type { AdminOrder, AdminOrderListParams, AdminOrderStatus, AdminOrdersPage, CreateShipmentPayload, SellerOrder, SellerOrderListParams, SellerOrdersPage, SellerOrderStatus, UpdateSellerOrderStatusPayload } from '../model/orderTypes';

const statuses: SellerOrderStatus[] = ['NEW', 'CONFIRMED', 'PENDING', 'SHIPMENT_CREATED', 'ON_THE_ROAD', 'DELIVERED', 'CANCELLED', 'RETURNED'];
const adminStatuses: AdminOrderStatus[] = ['DRAFT', 'PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'REFUNDED'];

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

function parseOrdersPage(data: unknown, label: string): SellerOrdersPage {
  const value = unwrapApiData(data);
  if (typeof value !== 'object' || value === null || !('items' in value) || !Array.isArray(value.items)) throw new Error(`${label} noto‘g‘ri formatda`);
  const page = value as Record<string, unknown>;
  return {
    items: value.items.map(parseOrder),
    total: numberField(page, 'total'),
    page: numberField(page, 'page'),
    limit: numberField(page, 'limit'),
    totalPages: numberField(page, 'totalPages'),
  };
}

export async function getSellerOrders(params: SellerOrderListParams, signal?: AbortSignal): Promise<SellerOrdersPage> {
  const { data } = await httpClient.get<unknown>('/seller/orders', { signal, params });
  return parseOrdersPage(data, 'Buyurtmalar ro‘yxati');
}

/**
 * Yetkazib berishga topshirilgan buyurtmalar. Backend `GET /seller/shipments`
 * buyurtma ro'yxati bilan bir xil qobiqni qaytaradi (faqat jo'natmalar filtri).
 */
export async function getSellerShipments(params: SellerOrderListParams, signal?: AbortSignal): Promise<SellerOrdersPage> {
  const { data } = await httpClient.get<unknown>('/seller/shipments', { signal, params });
  return parseOrdersPage(data, 'Jo‘natmalar ro‘yxati');
}

export async function updateSellerOrderStatus({ id, status }: UpdateSellerOrderStatusPayload): Promise<void> {
  await httpClient.patch(`/seller/orders/${encodeURIComponent(id)}`, { status });
}

export async function getSellerOrder(id: string, signal?: AbortSignal): Promise<unknown> {
  const { data } = await httpClient.get<unknown>(`/seller/orders/${encodeURIComponent(id)}`, { signal }); return unwrapApiData(data);
}
export async function getSellerOrderItems(id: string, signal?: AbortSignal): Promise<unknown> {
  const { data } = await httpClient.get<unknown>(`/seller/orders/${encodeURIComponent(id)}/items`, { signal }); return unwrapApiData(data);
}
export async function getSellerOrderHistory(id: string, signal?: AbortSignal): Promise<unknown> {
  const { data } = await httpClient.get<unknown>(`/seller/orders/${encodeURIComponent(id)}/history`, { signal }); return unwrapApiData(data);
}
export async function confirmSellerOrder(id: string): Promise<void> { await httpClient.post(`/seller/orders/${encodeURIComponent(id)}/confirm`); }
export async function cancelSellerOrder(id: string): Promise<void> { await httpClient.post(`/seller/orders/${encodeURIComponent(id)}/cancel`); }
export async function createSellerShipment({ id, customerPhone }: CreateShipmentPayload): Promise<void> { await httpClient.post(`/seller/orders/${encodeURIComponent(id)}/shipment`, { customerPhone }); }
export async function getSellerShipment(id: string, signal?: AbortSignal): Promise<unknown> { const { data } = await httpClient.get<unknown>(`/seller/shipments/${encodeURIComponent(id)}`, { signal }); return unwrapApiData(data); }
export async function getSellerShipmentTracking(id: string, signal?: AbortSignal): Promise<unknown> { const { data } = await httpClient.get<unknown>(`/seller/shipments/${encodeURIComponent(id)}/tracking`, { signal }); return unwrapApiData(data); }

const optionalNumber = (record: Record<string, unknown>, keys: string[]) => { for (const key of keys) if (typeof record[key] === 'number') return record[key]; return 0; };
const optionalText = (record: Record<string, unknown>, keys: string[]) => { for (const key of keys) if (typeof record[key] === 'string') return record[key]; return null; };
function parseAdminOrder(value: unknown): AdminOrder {
  if (typeof value !== 'object' || value === null) throw new Error('Admin buyurtmasi noto‘g‘ri formatda');
  const order = value as Record<string, unknown>; const id = optionalText(order, ['id']); const status = optionalText(order, ['status']);
  if (!id || !status || !adminStatuses.includes(status as AdminOrderStatus)) throw new Error('Admin buyurtmasining majburiy maydonlari mavjud emas');
  const payment = optionalText(order, ['paymentMethod']);
  return { id, orderNumber: optionalText(order, ['orderNumber', 'salesOrderId', 'number']) ?? id, buyerName: optionalText(order, ['buyerName', 'customerName']), totalAmount: optionalNumber(order, ['totalAmount', 'total', 'subtotal']), paymentMethod: payment === 'online' || payment === 'cod' ? payment : null, status: status as AdminOrderStatus, shopId: optionalText(order, ['shopId']), createdAt: optionalText(order, ['createdAt']) ?? '' };
}
export async function getAdminOrders(params: AdminOrderListParams, signal?: AbortSignal): Promise<AdminOrdersPage> {
  const { data } = await httpClient.get<unknown>('/admin/orders', { signal, params }); const value = unwrapApiData(data);
  if (typeof value !== 'object' || value === null) throw new Error('Admin buyurtmalari noto‘g‘ri formatda');
  const record = value as Record<string, unknown>; const list = Array.isArray(record.items) ? record.items : Array.isArray(value) ? value : null;
  if (!list) throw new Error('Admin buyurtmalari ro‘yxati mavjud emas'); const items = list.map(parseAdminOrder);
  const numeric = (key: string, fallback: number) => typeof record[key] === 'number' ? record[key] : fallback;
  return { items, total: numeric('total', items.length), page: numeric('page', params.page), limit: numeric('limit', params.limit), totalPages: numeric('totalPages', Math.max(1, Math.ceil(numeric('total', items.length) / params.limit))) };
}
export async function getAdminOrder(id: string, signal?: AbortSignal): Promise<unknown> { const { data } = await httpClient.get<unknown>(`/admin/orders/${encodeURIComponent(id)}`, { signal }); return unwrapApiData(data); }
