import axios from 'axios';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { readDto, readDtoList } from '../../../shared/api/readDto';
import { asRecord, readItems, readText } from '../../../shared/api/responseFields';
import type {
  AdminProduct,
  AdminProductListItem,
  AdminProductsPage,
  Creative,
  CreativeType,
  CreativeUploadPolicy,
  DeliveryMode,
  MarketCheckResult,
  ModerationSummary,
  OfferContent,
  PriceDecision,
  PriceQueueItem,
  ProductAuditEntry,
  ProductListTab,
  ProductPricing,
} from '../model/adminProductTypes';

/**
 * Admin: mahsulotlar, moderatsiya va offer sozlash (FE-12). BE-07/BE-09/BE-11 dagi endpointlar va
 * taklif qilinganlari (`contract/pending-endpoints.json`, docs/api-taklif/fe-12-admin-moderatsiya.md).
 */
const PRODUCT_KEYS = ['id', 'name', 'status', 'shopId', 'isBlocked', 'cpaEnabled', 'approvedPrice'] as const;

const textOrNull = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
const idOrNull = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : null);

/**
 * Backend `Product` entity sini qaytaradi: bigint ID lar satr, `text`/`jsonb` maydonlar sxemada `unknown` —
 * UI ga aniq tip bilan beriladi. Ro'yxatda `shop` relatsiyasi ham keladi (taklif: bitta mahsulotda ham).
 */
function readProduct(value: unknown): AdminProductListItem {
  const raw = readDto<AdminProductListItem>(value, PRODUCT_KEYS);
  const record = raw as unknown as Record<string, unknown>;
  const shop = record.shop && typeof record.shop === 'object' ? (record.shop as Record<string, unknown>) : null;
  return {
    ...raw,
    id: String(raw.id),
    shopId: String(raw.shopId),
    categoryId: idOrNull(record.categoryId),
    description: textOrNull(record.description),
    imageUrl: textOrNull(record.imageUrl),
    oldPrice: typeof record.oldPrice === 'number' ? record.oldPrice : null,
    images: Array.isArray(raw.images) ? raw.images.filter((url): url is string => typeof url === 'string') : [],
    shop: shop ? { id: idOrNull(shop.id) ?? String(raw.shopId), name: textOrNull(shop.name) ?? '', hasContract: typeof shop.hasContract === 'boolean' ? shop.hasContract : undefined } : null,
  };
}

export interface AdminProductsParams {
  tab: ProductListTab;
  search: string;
  page: number;
  limit: number;
  shopId?: string;
  /** Taklif (1-bo'lim): backend filtrlari qo'shilguncha mockda. */
  categoryId?: string;
  cpaEnabled?: boolean;
  attention?: 'OUT_OF_STOCK' | 'EXPIRY_SOON';
}

/** Yorliq → backend filtri: holat yoki «To'xtatilgan» (`blocked=true`). */
function tabFilter(tab: ProductListTab): { status?: string; blocked?: boolean } {
  if (tab === 'ALL') return {};
  if (tab === 'BLOCKED') return { blocked: true };
  return tab === 'ACTIVE' ? { status: tab, blocked: false } : { status: tab };
}

export async function getAdminProducts(params: AdminProductsParams, signal?: AbortSignal): Promise<AdminProductsPage> {
  const query = {
    ...tabFilter(params.tab),
    page: params.page,
    limit: params.limit,
    ...(params.search.trim() ? { search: params.search.trim() } : {}),
    ...(params.shopId ? { shopId: params.shopId } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.cpaEnabled !== undefined ? { cpaEnabled: params.cpaEnabled } : {}),
    ...(params.attention ? { attention: params.attention } : {}),
  };
  const { data } = await httpClient.get<unknown>('/admin/products', { params: query, signal });
  const page = readDto<AdminProductsPage>(data, ['items', 'total']);
  return { ...page, items: page.items.map((item) => readProduct(item)) };
}

const ALL_PAGE = 100;

/**
 * Hamma mahsulot, 100 tadan sahifalab (kategoriyalar: sonlar, panel va o'chirish tekshiruvi — backend ro'yxati
 * kategoriya bo'yicha filtrlamaydi). Ehtiyot chegarasi — 50 sahifa.
 */
export async function getAllAdminProducts(signal?: AbortSignal): Promise<AdminProductListItem[]> {
  const items: AdminProductListItem[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const result = await getAdminProducts({ tab: 'ALL', search: '', page, limit: ALL_PAGE }, signal);
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) break;
  }
  return items;
}

export async function getAdminProduct(id: string, signal?: AbortSignal): Promise<AdminProduct> {
  const { data } = await httpClient.get<unknown>(`/admin/products/${encodeURIComponent(id)}`, { signal });
  return readProduct(data);
}

/** OPT-2, ADM-1: tasdiq — mahsulot «Faol». Shartnomasiz optovik, og'irliksiz mahsulot — 409/400. */
export async function approveProduct(id: string): Promise<AdminProduct> {
  const { data } = await httpClient.post<unknown>(`/admin/products/${encodeURIComponent(id)}/approve`);
  return readProduct(data);
}

/** Sabab `moderationNote` ga yoziladi va optovik kabinetida ko'rinadi. */
export async function rejectProduct({ id, reason }: { id: string; reason: string }): Promise<AdminProduct> {
  const { data } = await httpClient.post<unknown>(`/admin/products/${encodeURIComponent(id)}/reject`, { reason });
  return readProduct(data);
}

/** «To'xtatish» (sabab majburiy): storefront, qidiruv va sotuvchilar katalogidan olinadi. */
export async function hideProduct({ id, reason }: { id: string; reason: string }): Promise<AdminProduct> {
  const { data } = await httpClient.post<unknown>(`/admin/products/${encodeURIComponent(id)}/hide`, { reason });
  return readProduct(data);
}

export async function reactivateProduct(id: string): Promise<AdminProduct> {
  const { data } = await httpClient.post<unknown>(`/admin/products/${encodeURIComponent(id)}/reactivate`);
  return readProduct(data);
}

/** «Qayerda sotiladi» va boshqa CPA maydonlari (BE-07 `AdminUpdateProductDto`). */
export async function updateProduct({ id, patch }: { id: string; patch: { cpaEnabled?: boolean; isBad?: boolean } }): Promise<AdminProduct> {
  const { data } = await httpClient.patch<unknown>(`/admin/products/${encodeURIComponent(id)}`, patch);
  return readProduct(data);
}

/** «Optovik:» filtri — BE-07 `GET /admin/wholesalers` (to'liq ro'yxat va karta — FE-25). */
export async function getWholesalerOptions(signal?: AbortSignal): Promise<{ id: string; name: string }[]> {
  const { data } = await httpClient.get<unknown>('/admin/wholesalers', { params: { page: 1, limit: 100 }, signal });
  const page = readDto<{ items: { id: unknown; name: unknown }[] }>(data, ['items']);
  return page.items.flatMap((item) => (typeof item.name === 'string' && idOrNull(item.id) ? [{ id: String(idOrNull(item.id)), name: item.name }] : []));
}

/** Taklif (2-bo'lim, BE-27): tablar va yorliqlar soni. */
export async function getModerationSummary(signal?: AbortSignal): Promise<ModerationSummary> {
  const { data } = await httpClient.get<unknown>('/admin/moderation/summary', { signal });
  return readDto<ModerationSummary>(data, ['productsPending', 'pricesPending', 'byStatus']);
}

/** BE-09 narx hisobi; `price`/`affiliateFee` berilsa — shu qiymatlar bilan qayta hisob («Haqni o'zgartirish»). */
export async function getProductPricing(
  { id, price, affiliateFee }: { id: string; price?: number; affiliateFee?: number },
  signal?: AbortSignal,
): Promise<ProductPricing> {
  const params = { ...(price !== undefined ? { price } : {}), ...(affiliateFee !== undefined ? { affiliateFee } : {}) };
  const { data } = await httpClient.get<unknown>(`/admin/products/${encodeURIComponent(id)}/pricing`, { params, signal });
  return readDto<ProductPricing>(data, ['params', 'calculation', 'approvedPrice', 'maxSalePrice']);
}

export async function getPriceDecisions(id: string, signal?: AbortSignal): Promise<PriceDecision[]> {
  const { data } = await httpClient.get<unknown>(`/admin/products/${encodeURIComponent(id)}/price-decisions`, { signal });
  return readDtoList<PriceDecision>(data, ['id', 'price', 'affiliateFee', 'status', 'createdAt']);
}

/**
 * NRX-6: narxni tasdiqlash (FE-13). Qizil — 400 (`details: Eng kam narx …`); to'q sariq — sabab majburiy, superadminga
 * xabar. `affiliateFee` berilsa — haq ham shu qaror bilan (NRX-13 zararsiz taklif). Javob — yangi hisob.
 */
export async function decidePrice({ id, price, affiliateFee, reason }: { id: string; price: number; affiliateFee?: number; reason?: string }): Promise<ProductPricing> {
  const body = { price, ...(affiliateFee !== undefined ? { affiliateFee } : {}), ...(reason ? { reason } : {}) };
  const { data } = await httpClient.post<unknown>(`/admin/products/${encodeURIComponent(id)}/price-decision`, body);
  return readDto<ProductPricing>(data, ['params', 'calculation', 'approvedPrice', 'maxSalePrice']);
}

/** Backend so'rovdagi maydonni hali bilmaydi: `forbidNonWhitelisted` → 400, `details[].field`. */
function rejectsField(error: unknown, field: string): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return false;
  return readItems(asRecord(error.response.data).details)?.some((item) => asRecord(item).field === field) ?? false;
}

/**
 * NRX-5: raqobatchida mijoz jami bilan solishtirish; summa mahsulotda saqlanadi. `source` — taklif (fe-13 §3):
 * backend uni hali qabul qilmasa, summa manbasiz saqlanadi.
 */
export async function checkMarketPrice({ id, competitorTotal, source }: { id: string; competitorTotal: number; source?: string }): Promise<MarketCheckResult> {
  const url = `/admin/products/${encodeURIComponent(id)}/market-check`;
  const send = async (body: object) => readDto<MarketCheckResult>((await httpClient.post<unknown>(url, body)).data, ['competitorTotal', 'ourTotal', 'verdict']);
  if (!source) return send({ competitorTotal });
  try {
    return await send({ competitorTotal, source });
  } catch (error) {
    if (rejectsField(error, 'source')) return send({ competitorTotal });
    throw error;
  }
}

/** Taklif (fe-13 §3): bozor narxi natijasini saqlamasdan oldindan ko'rish («Bozor narxini kiritish» oynasi). */
export async function previewMarketPrice({ id, competitorTotal }: { id: string; competitorTotal: number }, signal?: AbortSignal): Promise<MarketCheckResult> {
  const { data } = await httpClient.post<unknown>(`/admin/products/${encodeURIComponent(id)}/market-check`, { competitorTotal, preview: true }, { signal });
  return readDto<MarketCheckResult>(data, ['competitorTotal', 'ourTotal', 'verdict']);
}

/** TZ 2.4, NRX-8: mahsulot darajasida yetkazish rejimi (`null` — yuqori qatlamdan). */
export async function setProductDeliveryMode({ id, deliveryMode }: { id: string; deliveryMode: DeliveryMode | null }): Promise<void> {
  await httpClient.put<unknown>(`/admin/products/${encodeURIComponent(id)}/price-policy`, { deliveryMode });
}

/** Taklif (fe-13 §1): narx navbati — narx qarori kutayotgan mahsulotlar, tavsiya narx bilan. */
export async function getPriceQueue(signal?: AbortSignal): Promise<PriceQueueItem[]> {
  const { data } = await httpClient.get<unknown>('/admin/moderation/prices', { signal });
  const record = asRecord(unwrapApiData(data));
  return readDtoList<PriceQueueItem>(readItems(record.items) ?? [], ['productId', 'name', 'basePrice', 'recommended']);
}

/**
 * Sotuvchi haqini o'zgartirish (taklif, 6-bo'lim): tasdiqlangan narx o'zgarmaydi, haq va sabab narx qarori
 * bo'lib yoziladi; to'q sariqda superadminga xabar, qizil — 400.
 */
export async function changeAffiliateFee({ id, price, affiliateFee, reason }: { id: string; price: number; affiliateFee: number; reason: string }) {
  await httpClient.post<unknown>(`/admin/products/${encodeURIComponent(id)}/price-decision`, { price, affiliateFee, reason });
}

export async function getOfferContent(productId: string, signal?: AbortSignal): Promise<OfferContent> {
  const { data } = await httpClient.get<unknown>(`/admin/offer-content/${encodeURIComponent(productId)}`, { signal });
  return readDto<OfferContent>(data, ['productId', 'callScript', 'highlights', 'boxContents']);
}

export async function saveOfferContent({ productId, content }: { productId: string; content: Pick<OfferContent, 'highlights' | 'boxContents'> & { callScript?: string | null } }): Promise<OfferContent> {
  const { data } = await httpClient.put<unknown>(`/admin/offer-content/${encodeURIComponent(productId)}`, content);
  return readDto<OfferContent>(data, ['productId', 'callScript', 'highlights', 'boxContents']);
}

const CREATIVE_KEYS = ['id', 'type', 'url', 'position'] as const;

/** BE-08 (PR #127): kreativlar tartib bilan. */
export async function getCreatives(productId: string, signal?: AbortSignal): Promise<Creative[]> {
  const { data } = await httpClient.get<unknown>(`/admin/products/${encodeURIComponent(productId)}/creatives`, { signal });
  return readDtoList<Creative>(data, CREATIVE_KEYS).sort((a, b) => a.position - b.position);
}

export async function requestCreativeUpload(productId: string, file: { type: CreativeType; contentType: string; size: number }): Promise<CreativeUploadPolicy> {
  const { data } = await httpClient.post<unknown>(`/admin/products/${encodeURIComponent(productId)}/creatives/upload`, file);
  return readDto<CreativeUploadPolicy>(data, ['url', 'fields', 'objectKey']);
}

/**
 * Faylni imzolangan POST policy bilan to'g'ridan-to'g'ri omborga yuklaydi (`fields` avval, `file` oxirida).
 * XHR — yuklanish foizi uchun (100 MB gacha video).
 */
export function uploadCreativeFile(policy: CreativeUploadPolicy, file: File, onProgress: (percent: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(policy.fields).forEach(([key, value]) => form.append(key, value));
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', policy.url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Fayl yuklanmadi (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Aloqa uzildi — fayl yuklanmadi'));
    xhr.onabort = () => reject(new DOMException('Bekor qilindi', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

export async function confirmCreative({ productId, objectKey }: { productId: string; objectKey: string }): Promise<Creative> {
  const { data } = await httpClient.post<unknown>(`/admin/products/${encodeURIComponent(productId)}/creatives`, { objectKey });
  return readDto<Creative>(data, CREATIVE_KEYS);
}

/** Sabab — taklif (fe-12 §5): `DELETE` tanasida, audit uchun; hozirgi backend tanani e'tiborsiz qoldiradi. */
export async function deleteCreative({ productId, creativeId, reason }: { productId: string; creativeId: string; reason: string }): Promise<void> {
  await httpClient.delete(`/admin/products/${encodeURIComponent(productId)}/creatives/${encodeURIComponent(creativeId)}`, { data: { reason } });
}

/** Taklif (3-bo'lim): mavjud audit ro'yxati `entityType` + `entityId` bilan; eng yangisi tepada. */
/** Shu mahsulot auditi — vaqt bo'yicha (eski → yangi, admin-moderatsiya va admin-narx «Audit» jadvali). */
export async function getProductAudit(productId: string, signal?: AbortSignal): Promise<ProductAuditEntry[]> {
  const { data } = await httpClient.get<unknown>('/admin/audit', { params: { entityType: 'Product', entityId: productId, page: 1, limit: 50 }, signal });
  const items = readItems(unwrapApiData(data), 'items');
  if (!items) throw new Error('Audit yozuvlari noto‘g‘ri formatda');
  return items.map((value) => {
    const row = asRecord(value);
    return {
      id: readText(row, 'id'),
      at: readText(row, 'createdAt'),
      actorName: readText(row, 'actorName') || null,
      action: readText(row, 'action'),
      meta: asRecord(row.meta),
    };
  }).sort((a, b) => a.at.localeCompare(b.at));
}
