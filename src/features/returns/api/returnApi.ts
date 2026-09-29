import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readPagination, readText, type UnknownRecord } from '../../../shared/api/responseFields';
import { RETURN_REASONS, RETURN_STATUSES } from '../lib/returnRules';
import type {
  AdminReturnListParams,
  ReturnCommentPayload,
  ReturnHistoryEntry,
  ReturnItem,
  ReturnReason,
  ReturnRefundPayload,
  ReturnRejectPayload,
  ReturnRequest,
  ReturnRequestDetail,
  ReturnsPage,
  ReturnStatus,
  SellerReturnListParams,
} from '../model/returnTypes';

const text = (row: UnknownRecord, key: string): string | null => readText(row, key).trim() || null;
const isStatus = (value: unknown): value is ReturnStatus => RETURN_STATUSES.includes(value as ReturnStatus);

function amount(row: UnknownRecord, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Qaytarish so‘rovining ${key} maydoni noto‘g‘ri`);
  return value;
}

function parseItem(value: unknown): ReturnItem {
  const row = asRecord(value);
  const id = readText(row, 'id');
  if (!id) throw new Error('Qaytarilayotgan tovar ma’lumoti noto‘g‘ri');
  return {
    id,
    orderItemId: readText(row, 'orderItemId'),
    productId: readText(row, 'productId'),
    variantId: readText(row, 'variantId'),
    productName: text(row, 'productName') ?? '—',
    // Rasm manzili faqat http(s) — boshqa sxemalar <img src> ga tushmaydi.
    imageUrl: /^https?:\/\//i.test(readText(row, 'imageUrl')) ? readText(row, 'imageUrl') : null,
    quantity: amount(row, 'quantity'),
    unitPrice: amount(row, 'unitPrice'),
    lineTotal: amount(row, 'lineTotal'),
  };
}

function parseReturn(value: unknown): ReturnRequest {
  const row = asRecord(value);
  const id = readText(row, 'id');
  if (!id || !isStatus(row.status) || !RETURN_REASONS.includes(row.reason as ReturnReason) || typeof row.createdAt !== 'string') {
    throw new Error('Qaytarish so‘rovi noto‘g‘ri formatda keldi');
  }
  const refunded = row.refundedAmount;
  return {
    id,
    orderId: readText(row, 'orderId'),
    sellerOrderId: readText(row, 'sellerOrderId'),
    shopId: readText(row, 'shopId'),
    shopName: text(row, 'shopName'),
    buyerName: text(row, 'buyerName'),
    status: row.status,
    reason: row.reason as ReturnReason,
    comment: text(row, 'comment'),
    paymentMethod: row.paymentMethod === 'cod' ? 'cod' : 'online',
    requestedAmount: amount(row, 'requestedAmount'),
    refundedAmount: typeof refunded === 'number' && Number.isFinite(refunded) ? refunded : null,
    restocked: typeof row.restocked === 'boolean' ? row.restocked : null,
    decisionComment: text(row, 'decisionComment'),
    decidedAt: text(row, 'decidedAt'),
    refundedAt: text(row, 'refundedAt'),
    createdAt: row.createdAt,
    updatedAt: readText(row, 'updatedAt') || row.createdAt,
    items: (readItems(row.items) ?? []).map(parseItem),
  };
}

function parseHistory(value: unknown): ReturnHistoryEntry | null {
  const row = asRecord(value);
  if (!isStatus(row.toStatus) || typeof row.createdAt !== 'string') return null;
  return {
    fromStatus: isStatus(row.fromStatus) ? row.fromStatus : null,
    toStatus: row.toStatus,
    actorRole: readText(row, 'actorRole').toUpperCase(),
    comment: text(row, 'comment'),
    createdAt: row.createdAt,
  };
}

function parseDetail(data: unknown): ReturnRequestDetail {
  const value = unwrapApiData(data);
  const history = (readItems(asRecord(value).history) ?? []).map(parseHistory).filter((entry) => entry !== null);
  // Tarix vaqt bo'yicha: eng eski birinchi — timeline yuqoridan pastga o'qiladi.
  history.sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt));
  return { ...parseReturn(value), history };
}

function parsePage(data: unknown, params: SellerReturnListParams): ReturnsPage {
  const value = unwrapApiData(data);
  const rawItems = readItems(value, 'items');
  if (!rawItems) throw new Error('Qaytarish so‘rovlari ro‘yxati noto‘g‘ri formatda');
  const items = rawItems.map(parseReturn);
  return { items, ...readPagination(asRecord(value), { page: params.page, limit: params.limit, itemCount: items.length }) };
}

// Sotuvchi / operator: faqat o'z do'koni so'rovlari.
export async function getSellerReturns(params: SellerReturnListParams, signal?: AbortSignal): Promise<ReturnsPage> {
  const { data } = await httpClient.get<unknown>('/seller/returns', { params, signal });
  return parsePage(data, params);
}

export async function getSellerReturn(id: string, signal?: AbortSignal): Promise<ReturnRequestDetail> {
  const { data } = await httpClient.get<unknown>(`/seller/returns/${encodeURIComponent(id)}`, { signal });
  return parseDetail(data);
}

/** SUBMITTED → IN_REVIEW: "tovarni oldim, tekshiryapman". Ixtiyoriy qadam. */
export async function reviewSellerReturn({ id, comment }: ReturnCommentPayload): Promise<ReturnRequestDetail> {
  const { data } = await httpClient.post<unknown>(`/seller/returns/${encodeURIComponent(id)}/review`, comment ? { comment } : {});
  return parseDetail(data);
}

export async function approveSellerReturn({ id, comment }: ReturnCommentPayload): Promise<ReturnRequestDetail> {
  const { data } = await httpClient.post<unknown>(`/seller/returns/${encodeURIComponent(id)}/approve`, comment ? { comment } : {});
  return parseDetail(data);
}

export async function rejectSellerReturn({ id, reason }: ReturnRejectPayload): Promise<ReturnRequestDetail> {
  const { data } = await httpClient.post<unknown>(`/seller/returns/${encodeURIComponent(id)}/reject`, { reason });
  return parseDetail(data);
}

// Admin: barcha do'konlar; qarorni o'zgartira oladi (nizo yechish).
export async function getAdminReturns(params: AdminReturnListParams, signal?: AbortSignal): Promise<ReturnsPage> {
  const { data } = await httpClient.get<unknown>('/admin/returns', { params, signal });
  return parsePage(data, params);
}

export async function getAdminReturn(id: string, signal?: AbortSignal): Promise<ReturnRequestDetail> {
  const { data } = await httpClient.get<unknown>(`/admin/returns/${encodeURIComponent(id)}`, { signal });
  return parseDetail(data);
}

export async function approveAdminReturn({ id, comment }: ReturnCommentPayload): Promise<ReturnRequestDetail> {
  const { data } = await httpClient.post<unknown>(`/admin/returns/${encodeURIComponent(id)}/approve`, comment ? { comment } : {});
  return parseDetail(data);
}

export async function rejectAdminReturn({ id, reason }: ReturnRejectPayload): Promise<ReturnRequestDetail> {
  const { data } = await httpClient.post<unknown>(`/admin/returns/${encodeURIComponent(id)}/reject`, { reason });
  return parseDetail(data);
}

/** Faqat SUPERADMIN, faqat APPROVED. Idempotent: takror chaqiruv pulni ikkinchi marta qaytarmaydi. */
export async function refundAdminReturn({ id, amount: value, restock, comment }: ReturnRefundPayload): Promise<ReturnRequestDetail> {
  const { data } = await httpClient.post<unknown>(`/admin/returns/${encodeURIComponent(id)}/refund`, { amount: value, restock, ...(comment ? { comment } : {}) });
  return parseDetail(data);
}
