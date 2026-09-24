import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type { Banner, BannerOrderItem, BannerPayload } from '../model/bannerTypes';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const nullableText = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

function parseBanner(value: unknown): Banner {
  if (!value || typeof value !== 'object') throw new Error('Banner noto‘g‘ri formatda');
  const row = value as Record<string, unknown>;
  if ((typeof row.id !== 'string' && typeof row.id !== 'number') || typeof row.title !== 'string') {
    throw new Error('Banner majburiy maydonlari yo‘q');
  }
  return {
    id: String(row.id),
    title: row.title,
    imageUrl: text(row.imageUrl),
    linkUrl: nullableText(row.linkUrl),
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
    isActive: row.isActive !== false,
    startsAt: nullableText(row.startsAt),
    endsAt: nullableText(row.endsAt),
    isVisible: row.isVisible === true,
  };
}

function parseList(value: unknown): Banner[] {
  if (!Array.isArray(value)) throw new Error('Bannerlar ro‘yxati noto‘g‘ri formatda');
  return value.map(parseBanner);
}

export async function getBanners(signal?: AbortSignal): Promise<Banner[]> {
  const { data } = await httpClient.get<unknown>('/admin/content/banners', { signal });
  return parseList(unwrapApiData(data));
}
export async function createBanner(payload: BannerPayload): Promise<Banner> {
  const { data } = await httpClient.post<unknown>('/admin/content/banners', payload);
  return parseBanner(unwrapApiData(data));
}
export async function updateBanner({ id, payload }: { id: string; payload: BannerPayload }): Promise<Banner> {
  const { data } = await httpClient.patch<unknown>(`/admin/content/banners/${encodeURIComponent(id)}`, payload);
  return parseBanner(unwrapApiData(data));
}
/** Butun ro'yxat yuboriladi — backend bittasi topilmasa hech birini saqlamaydi. */
export async function reorderBanners(items: BannerOrderItem[]): Promise<Banner[]> {
  const { data } = await httpClient.patch<unknown>('/admin/content/banners/order', { items });
  return parseList(unwrapApiData(data));
}
/**
 * Banner rasmi MinIO'ning ochiq `banners/` papkasiga yuklanadi. `/files/upload`
 * ishlatilmaydi: u faqat sotuvchi uchun va rasmni mahsulotga biriktiradi.
 */
export async function uploadBannerImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new Error('Yuklash uchun fayl tanlang');
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await httpClient.post<unknown>('/admin/content/banners/image', formData, {
    timeout: 60_000,
    onUploadProgress: ({ loaded, total }) => {
      if (total) onProgress?.(Math.min(99, Math.round((loaded / total) * 100)));
    },
  });
  const result = unwrapApiData(data);
  const url = result && typeof result === 'object' ? (result as Record<string, unknown>).url : undefined;
  if (typeof url !== 'string' || !url.trim()) throw new Error('Rasm yuklandi, ammo server manzil qaytarmadi');
  return url;
}

export async function deleteBanner(id: string): Promise<void> {
  await httpClient.delete(`/admin/content/banners/${encodeURIComponent(id)}`);
}
