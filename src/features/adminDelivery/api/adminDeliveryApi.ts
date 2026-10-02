import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readNumber, readPagination, readText, type UnknownRecord } from '../../../shared/api/responseFields';
import type {
  AdminDeliveryPage,
  AdminShipment,
  AdminShipmentListParams,
  AdminWebhookEvent,
  AdminWebhookListParams,
  ReprovisionResult,
} from '../model/adminDeliveryTypes';

const nullableText = (row: UnknownRecord, key: string) => readText(row, key) || null;

function parseShipment(value: unknown): AdminShipment {
  const row = asRecord(value);
  const id = readText(row, 'id');
  if (!id) throw new Error('Posilka qatori noto‘g‘ri formatda');
  return {
    id,
    salesOrderId: readText(row, 'salesOrderId'),
    shopId: readText(row, 'shopId'),
    shipmentId: nullableText(row, 'shipmentId'),
    trackingUrl: nullableText(row, 'trackingUrl'),
    status: readText(row, 'status'),
    orderStatus: nullableText(row, 'orderStatus'),
    paymentMethod: nullableText(row, 'paymentMethod'),
    codAmount: readNumber(row, ['codAmount']),
    buyerName: nullableText(row, 'buyerName'),
    createdAt: readText(row, 'createdAt'),
    updatedAt: readText(row, 'updatedAt'),
  };
}

function parseWebhook(value: unknown): AdminWebhookEvent {
  const row = asRecord(value);
  const eventId = readText(row, 'eventId');
  if (!eventId) throw new Error('Webhook yozuvi noto‘g‘ri formatda');
  return {
    eventId,
    shipmentId: nullableText(row, 'shipmentId'),
    sellerOrderId: nullableText(row, 'sellerOrderId'),
    status: readText(row, 'status'),
    occurredAt: nullableText(row, 'occurredAt'),
    processedAt: nullableText(row, 'processedAt'),
    payload: row.payload ?? null,
  };
}

/** Yo‘llar chaqiruvda literal: `npm run contract:check` ularni OpenAPI bilan solishtiradi. */
function readPage<T>(data: unknown, params: { page: number; limit: number }, parse: (value: unknown) => T): AdminDeliveryPage<T> {
  const value = unwrapApiData(data);
  const rawItems = readItems(value, 'items');
  if (!rawItems) throw new Error('Ro‘yxat noto‘g‘ri formatda');
  const items = rawItems.map(parse);
  return { items, ...readPagination(asRecord(value), { page: params.page, limit: params.limit, itemCount: items.length }) };
}

export async function getAdminShipments(params: AdminShipmentListParams, signal?: AbortSignal): Promise<AdminDeliveryPage<AdminShipment>> {
  const { data } = await httpClient.get<unknown>('/admin/integration/shipments', { params, signal });
  return readPage(data, params, parseShipment);
}

export async function getAdminWebhooks(params: AdminWebhookListParams, signal?: AbortSignal): Promise<AdminDeliveryPage<AdminWebhookEvent>> {
  const { data } = await httpClient.get<unknown>('/admin/integration/webhooks', { params, signal });
  return readPage(data, params, parseWebhook);
}

export async function reprovisionShop(shopId: string): Promise<ReprovisionResult> {
  const { data } = await httpClient.post<unknown>(`/admin/integration/shops/${encodeURIComponent(shopId)}/reprovision`);
  const row = asRecord(unwrapApiData(data));
  return {
    shopId: readText(row, 'shopId') || shopId,
    elchiMarketId: nullableText(row, 'elchiMarketId'),
    status: readText(row, 'status'),
    reprovisioned: row.reprovisioned === true,
    error: nullableText(row, 'error'),
  };
}
