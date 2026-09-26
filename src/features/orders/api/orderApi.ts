import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type { AdminOrder, AdminOrderActionPayload, AdminOrderActionResult, AdminOrderDetail, AdminOrderHistoryEntry, AdminOrderItemDetail, AdminOrderListParams, AdminOrderPaymentDetail, AdminOrderShipmentDetail, AdminOrderStatus, AdminOrdersPage, AdminSubOrder, CreateShipmentPayload, SellerOrder, SellerOrderListParams, SellerOrdersPage, SellerOrderStatus, UpdateSellerOrderStatusPayload } from '../model/orderTypes';

const statuses: SellerOrderStatus[] = ['NEW', 'CONFIRMED', 'PENDING', 'SHIPMENT_CREATED', 'RECEIVED', 'ON_THE_ROAD', 'DELIVERED', 'CANCELLED', 'RETURNED'];
const adminStatuses: AdminOrderStatus[] = ['DRAFT', 'PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'REFUNDED'];

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Buyurtmaning ${key} maydoni noto‘g‘ri`);
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** Tashqi havola sifatida faqat http(s) — `javascript:`/`data:` kabi sxemalar `href` ga tushmaydi. */
function safeHttpUrl(value: unknown): string | null {
  const text = nullableString(value);
  if (!text) return null;
  try { return ['http:', 'https:'].includes(new URL(text).protocol) ? text : null; }
  catch { return null; }
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
    trackingUrl: safeHttpUrl(order.trackingUrl),
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
  return { id, orderNumber: optionalText(order, ['orderNumber', 'salesOrderId', 'number']) ?? id, buyerName: optionalText(order, ['buyerName', 'customerName']), buyerPhone: optionalText(order, ['buyerPhone', 'customerPhone', 'phone']), totalAmount: optionalNumber(order, ['totalAmount', 'total', 'subtotal']), paymentMethod: payment === 'online' || payment === 'cod' ? payment : null, status: status as AdminOrderStatus, shopId: optionalText(order, ['shopId']), shopName: optionalText(order, ['shopName', 'storeName']), sellersCount: optionalNumber(order, ['sellersCount']), createdAt: optionalText(order, ['createdAt']) ?? '' };
}
export async function getAdminOrders(params: AdminOrderListParams, signal?: AbortSignal): Promise<AdminOrdersPage> {
  const { data } = await httpClient.get<unknown>('/admin/orders', { signal, params }); const value = unwrapApiData(data);
  if (typeof value !== 'object' || value === null) throw new Error('Admin buyurtmalari noto‘g‘ri formatda');
  const record = value as Record<string, unknown>; const list = Array.isArray(record.items) ? record.items : Array.isArray(value) ? value : null;
  if (!list) throw new Error('Admin buyurtmalari ro‘yxati mavjud emas'); const items = list.map(parseAdminOrder);
  const numeric = (key: string, fallback: number) => typeof record[key] === 'number' ? record[key] : fallback;
  return { items, total: numeric('total', items.length), page: numeric('page', params.page), limit: numeric('limit', params.limit), totalPages: numeric('totalPages', Math.max(1, Math.ceil(numeric('total', items.length) / params.limit))) };
}
const asRecord = (value: unknown): Record<string, unknown> | null => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const recordsAt = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) if (Array.isArray(record[key])) return (record[key] as unknown[]).map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
  return [];
};
const nullableNumber = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) if (typeof record[key] === 'number' && Number.isFinite(record[key])) return record[key];
  return null;
};
const identify = (record: Record<string, unknown>, fallback: string) => optionalText(record, ['id', 'orderId', 'sellerOrderId', 'itemId', 'shipmentId', 'eventId']) ?? fallback;

function parseSubOrder(record: Record<string, unknown>, index: number): AdminSubOrder {
  return { id: identify(record, String(index + 1)), shopId: optionalText(record, ['shopId', 'storeId']), shopName: optionalText(record, ['shopName', 'storeName']), status: optionalText(record, ['status']) ?? '—', amount: nullableNumber(record, ['subtotal', 'totalAmount', 'total', 'amount']), createdAt: optionalText(record, ['createdAt']) };
}
function parseAdminItem(record: Record<string, unknown>, index: number): AdminOrderItemDetail {
  const quantity = nullableNumber(record, ['quantity', 'qty']);
  const unitPrice = nullableNumber(record, ['unitPrice', 'price']);
  return { id: identify(record, String(index + 1)), name: optionalText(record, ['name', 'productName', 'title']) ?? `#${identify(record, String(index + 1))}`, sku: optionalText(record, ['sku', 'variantSku']), quantity, unitPrice, totalPrice: nullableNumber(record, ['lineTotal', 'totalPrice', 'total', 'subtotal']) ?? (quantity !== null && unitPrice !== null ? quantity * unitPrice : null) };
}
function parseShipment(record: Record<string, unknown>, index: number): AdminOrderShipmentDetail {
  return { id: identify(record, String(index + 1)), provider: optionalText(record, ['provider', 'carrier', 'service']), status: optionalText(record, ['status']), trackingUrl: optionalText(record, ['trackingUrl', 'trackingLink']), createdAt: optionalText(record, ['createdAt']) };
}
function parseHistory(record: Record<string, unknown>, index: number): AdminOrderHistoryEntry {
  return { id: identify(record, String(index + 1)), status: optionalText(record, ['status', 'action', 'event']) ?? '—', note: optionalText(record, ['note', 'comment', 'reason', 'description']), actorName: optionalText(record, ['actorName', 'userName', 'createdBy']), createdAt: optionalText(record, ['createdAt', 'date', 'timestamp']) };
}
function parsePayment(record: Record<string, unknown>): AdminOrderPaymentDetail {
  return { method: optionalText(record, ['method', 'paymentMethod']), status: optionalText(record, ['status']), amount: nullableNumber(record, ['amount', 'totalAmount', 'total']), transactionId: optionalText(record, ['transactionId', 'id']) };
}
function parseAddress(value: unknown): string | null {
  if (typeof value === 'string') return value;
  const address = asRecord(value);
  if (!address) return null;
  return ['region', 'district', 'city', 'street', 'address', 'house']
    .map((key) => optionalText(address, [key]))
    .filter((part): part is string => Boolean(part))
    .join(', ') || null;
}
function parseAdminOrderDetail(value: unknown): AdminOrderDetail {
  const record = asRecord(value);
  if (!record) throw new Error('Admin buyurtma tafsiloti noto‘g‘ri formatda');
  const sellerOrderRecords = recordsAt(record, ['sellerOrders', 'subOrders', 'orders']);
  const directItems = recordsAt(record, ['items', 'orderItems']);
  const directShipments = recordsAt(record, ['shipments']);
  const directHistory = recordsAt(record, ['history', 'statusHistory', 'events']);
  const nestedItems = sellerOrderRecords.flatMap((item) => recordsAt(item, ['items', 'orderItems']));
  const nestedShipments = sellerOrderRecords.flatMap((item) => {
    const shipment = asRecord(item.shipment);
    const shipments = [...recordsAt(item, ['shipments']), ...(shipment ? [shipment] : [])];
    // Marketplace backend puts Elchi shipment fields directly on each seller order.
    if (!shipments.length && optionalText(item, ['elchiShipmentId'])) {
      shipments.push({ id: item.elchiShipmentId, provider: 'Elchi', status: item.status, trackingUrl: item.trackingUrl });
    }
    return shipments;
  });
  const nestedHistory = sellerOrderRecords.flatMap((item) => recordsAt(item, ['history', 'statusHistory', 'events']));
  const shipment = asRecord(record.shipment);
  const payment = asRecord(record.payment);
  let summary: AdminOrder | null = null;
  try {
    summary = parseAdminOrder(record);
  } catch {
    // Ayrim eski backend javoblarida detail faqat ichki bo‘limlarni qaytaradi.
  }
  return {
    summary,
    deliveryAddress: parseAddress(record.deliveryAddress ?? record.address),
    sellerOrders: sellerOrderRecords.map(parseSubOrder),
    items: [...directItems, ...nestedItems].map(parseAdminItem),
    shipments: [...directShipments, ...(shipment ? [shipment] : []), ...nestedShipments].map(parseShipment),
    history: [...directHistory, ...nestedHistory].map(parseHistory),
    payment: payment ? parsePayment(payment) : optionalText(record, ['paymentMethod']) ? parsePayment({ method: record.paymentMethod, amount: record.totalAmount }) : null,
  };
}
export async function getAdminOrder(id: string, signal?: AbortSignal): Promise<AdminOrderDetail> { const { data } = await httpClient.get<unknown>(`/admin/orders/${encodeURIComponent(id)}`, { signal }); return parseAdminOrderDetail(unwrapApiData(data)); }

/** Refund/cancel javobi: `{ status, idempotent }`. Amal bajarilgan bo‘lishi mumkin, shuning uchun javob shakli qat’iy tekshirilmaydi. */
function parseAdminOrderActionResult(data: unknown): AdminOrderActionResult {
  return { idempotent: asRecord(unwrapApiData(data))?.idempotent === true };
}
export async function refundAdminOrder({ id, reason }: AdminOrderActionPayload): Promise<AdminOrderActionResult> {
  const { data } = await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/refund`, { reason }); return parseAdminOrderActionResult(data);
}
export async function cancelAdminOrder({ id, reason }: AdminOrderActionPayload): Promise<AdminOrderActionResult> {
  const { data } = await httpClient.post<unknown>(`/admin/orders/${encodeURIComponent(id)}/cancel`, { reason }); return parseAdminOrderActionResult(data);
}
