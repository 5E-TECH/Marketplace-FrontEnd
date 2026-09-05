import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type { AdminShop, AdminShopDetail, AdminShopListParams, AdminShopPage, AdminShopStatus } from '../model/adminShopTypes';

const statuses: AdminShopStatus[] = ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'REJECTED'];

function text(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) if (typeof record[key] === 'string') return record[key];
  return '';
}

function parseShop(value: unknown): AdminShop {
  if (typeof value !== 'object' || value === null) throw new Error('Market ma’lumoti noto‘g‘ri formatda');
  const shop = value as Record<string, unknown>;
  const rawStatus = text(shop, 'status').toUpperCase();
  if (
    (typeof shop.id !== 'string' && typeof shop.id !== 'number') ||
    (typeof shop.ownerUserId !== 'string' && typeof shop.ownerUserId !== 'number') ||
    typeof shop.name !== 'string' || typeof shop.phone !== 'string' ||
    !statuses.includes(rawStatus as AdminShopStatus)
  ) throw new Error('Marketning majburiy maydonlari mavjud emas');
  const nullableText = (key: string) => typeof shop[key] === 'string' ? shop[key] : null;
  return {
    id: String(shop.id),
    ownerUserId: String(shop.ownerUserId),
    name: shop.name,
    slug: text(shop, 'slug'),
    description: nullableText('description'),
    logoUrl: nullableText('logoUrl'),
    bannerUrl: nullableText('bannerUrl'),
    status: rawStatus as AdminShopStatus,
    phone: shop.phone,
    regionId: nullableText('regionId'),
    districtId: nullableText('districtId'),
    address: nullableText('address'),
    rating: typeof shop.rating === 'number' ? shop.rating : 0,
    ordersCount: typeof shop.ordersCount === 'number' ? shop.ordersCount : 0,
    elchiMarketId: nullableText('elchiMarketId'),
    isDeleted: shop.isDeleted === true,
    createdAt: text(shop, 'createdAt'),
    updatedAt: text(shop, 'updatedAt'),
  };
}

export async function getAdminShops(params: AdminShopListParams, signal?: AbortSignal): Promise<AdminShopPage> {
  const { data } = await httpClient.get<unknown>('/admin/shops', { signal, params });
  const value = unwrapApiData(data);
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const rawItems = Array.isArray(value) ? value : Array.isArray(record.items) ? record.items : Array.isArray(record.shops) ? record.shops : null;
  if (!rawItems) throw new Error('Marketlar ro‘yxati noto‘g‘ri formatda');
  const items = rawItems.map(parseShop);
  const numberValue = (key: string, fallback: number) => typeof record[key] === 'number' ? record[key] : fallback;
  return { items, total: numberValue('total', items.length), page: numberValue('page', params.page), limit: numberValue('limit', params.limit) };
}

export async function approveAdminShop(shopId: string): Promise<void> {
  await httpClient.post(`/admin/shops/${encodeURIComponent(shopId)}/approve`);
}

export async function getAdminShopDetail(shopId: string, signal?: AbortSignal): Promise<AdminShopDetail> {
  const { data } = await httpClient.get<unknown>(`/admin/shops/${encodeURIComponent(shopId)}`, { signal });
  const value = unwrapApiData(data);
  if (!value || typeof value !== 'object') throw new Error('Market tafsiloti noto‘g‘ri formatda');
  const row = value as Record<string, unknown>;
  const stats = row.stats && typeof row.stats === 'object' ? row.stats as Record<string, unknown> : {};
  const status = text(row, 'status').toUpperCase() as AdminShopStatus;
  if ((typeof row.id !== 'string' && typeof row.id !== 'number') || (typeof row.ownerUserId !== 'string' && typeof row.ownerUserId !== 'number') || typeof row.name !== 'string' || !statuses.includes(status)) throw new Error('Market tafsilotining majburiy maydonlari yo‘q');
  const count = (key: string) => typeof stats[key] === 'number' && Number.isFinite(stats[key]) ? stats[key] : 0;
  return { id: String(row.id), ownerUserId: String(row.ownerUserId), name: row.name, status, stats: { products: count('products'), orders: count('orders'), warehouses: count('warehouses') } };
}

export async function rejectAdminShop({ shopId, reason }: { shopId: string; reason: string }): Promise<void> {
  await httpClient.post(`/admin/shops/${encodeURIComponent(shopId)}/reject`, { reason });
}

export async function suspendAdminShop(shopId: string): Promise<void> {
  await httpClient.post(`/admin/shops/${encodeURIComponent(shopId)}/suspend`);
}

export async function activateAdminShop(shopId: string): Promise<void> {
  await httpClient.post(`/admin/shops/${encodeURIComponent(shopId)}/activate`);
}
