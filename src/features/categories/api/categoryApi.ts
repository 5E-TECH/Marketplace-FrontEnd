import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type { Category, CategoryPayload } from '../model/categoryTypes';

function parseCategory(value: unknown): Category {
  if (!value || typeof value !== 'object') throw new Error('Kategoriya noto‘g‘ri formatda');
  const row = value as Record<string, unknown>;
  if ((typeof row.id !== 'string' && typeof row.id !== 'number') || typeof row.name !== 'string') throw new Error('Kategoriya majburiy maydonlari yo‘q');
  const children = Array.isArray(row.children) ? row.children.map(parseCategory) : [];
  return { id: String(row.id), name: row.name, slug: typeof row.slug === 'string' ? row.slug : '', parentId: typeof row.parentId === 'string' || typeof row.parentId === 'number' ? String(row.parentId) : null, iconUrl: typeof row.iconUrl === 'string' ? row.iconUrl : null, sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0, isActive: row.isActive !== false, children };
}

export async function getAdminCategories(signal?: AbortSignal): Promise<Category[]> { const { data } = await httpClient.get<unknown>('/admin/categories', { signal }); const value = unwrapApiData(data); if (!Array.isArray(value)) throw new Error('Kategoriyalar ro‘yxati noto‘g‘ri formatda'); return value.map(parseCategory); }
export async function createCategory(payload: CategoryPayload): Promise<Category> { const { data } = await httpClient.post<unknown>('/admin/categories', payload); return parseCategory(unwrapApiData(data)); }
export async function updateCategory({ id, payload }: { id: string; payload: CategoryPayload }): Promise<Category> { const { data } = await httpClient.patch<unknown>(`/admin/categories/${encodeURIComponent(id)}`, payload); return parseCategory(unwrapApiData(data)); }
export async function deleteCategory(id: string): Promise<void> { await httpClient.delete(`/admin/categories/${encodeURIComponent(id)}`); }

/**
 * Sotuvchi kabineti uchun ochiq kategoriya daraxti. `/admin/categories` dan
 * farqi: bunga ADMIN roli talab qilinmaydi, shuning uchun mahsulot formasida
 * sotuvchi ham kategoriyani ro'yxatdan tanlay oladi.
 */
export async function getPublicCategories(signal?: AbortSignal): Promise<Category[]> {
  const { data } = await httpClient.get<unknown>('/categories', { signal });
  const value = unwrapApiData(data);
  if (!Array.isArray(value)) throw new Error('Kategoriyalar ro‘yxati noto‘g‘ri formatda');
  return value.map(parseCategory);
}
