import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readPagination, readText } from '../../../shared/api/responseFields';
import type { AdminUser, AdminUserListParams, AdminUserRole, AdminUsersPage, CreateAdminUserPayload } from '../model/adminUserTypes';

const roles: AdminUserRole[] = ['SELLER', 'OPERATOR', 'BUYER', 'ADMIN', 'SUPERADMIN'];

function parseUser(value: unknown): AdminUser {
  if (!value || typeof value !== 'object') throw new Error('Foydalanuvchi ma’lumoti noto‘g‘ri formatda');
  const row = asRecord(value);
  const role = typeof row.role === 'string' ? row.role.toUpperCase() : '';
  if ((typeof row.id !== 'string' && typeof row.id !== 'number') || !roles.includes(role as AdminUserRole)) {
    throw new Error('Foydalanuvchining majburiy maydonlari mavjud emas');
  }
  return {
    id: String(row.id),
    name: readText(row, 'name', 'fullName'),
    phone: readText(row, 'phone'),
    email: readText(row, 'email') || null,
    avatarUrl: readText(row, 'avatarUrl') || null,
    role: role as AdminUserRole,
    isActive: row.isActive !== false,
    isBlocked: row.blocked === true || row.isBlocked === true,
    isDeleted: row.isDeleted === true,
    shopId: row.shopId === null ? null : readText(row, 'shopId') || null,
    blocked: row.blocked === true || row.isBlocked === true,
    createdAt: readText(row, 'createdAt'),
    updatedAt: readText(row, 'updatedAt'),
  };
}

export async function getAdminUsers(params: AdminUserListParams, signal?: AbortSignal): Promise<AdminUsersPage> {
  const { data } = await httpClient.get<unknown>('/admin/users', { params, signal });
  const value = unwrapApiData(data);
  const record = asRecord(value);
  const rawItems = readItems(value, 'items');
  if (!rawItems) throw new Error('Foydalanuvchilar ro‘yxati noto‘g‘ri formatda');
  const items = rawItems.map(parseUser);
  return { items, ...readPagination(record, { page: params.page, limit: params.limit, itemCount: items.length }) };
}

export async function getAdminUser(id: string, signal?: AbortSignal): Promise<AdminUser> {
  const { data } = await httpClient.get<unknown>(`/admin/users/${encodeURIComponent(id)}`, { signal });
  return parseUser(unwrapApiData(data));
}

export async function setAdminUserBlocked({ id, blocked }: { id: string; blocked: boolean }): Promise<void> {
  const userId = encodeURIComponent(id);
  if (blocked) {
    await httpClient.post(`/admin/users/${userId}/block`);
  } else {
    await httpClient.post(`/admin/users/${userId}/unblock`);
  }
}

function readErrorMessage(value: unknown): string {
  if (!value || typeof value !== 'object' || !('message' in value)) {
    return 'Foydalanuvchini yaratib bo‘lmadi';
  }
  const message = value.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const messages = message.filter((item): item is string => typeof item === 'string');
    if (messages.length) return messages.join('. ');
  }
  return 'Foydalanuvchini yaratib bo‘lmadi';
}

/**
 * Register endpoint refresh cookie qaytaradi. Adminning joriy sessiyasi
 * almashib ketmasligi uchun javob credentials'siz olinadi.
 */
export async function createAdminUser(payload: CreateAdminUserPayload): Promise<void> {
  const apiBaseUrl = (import.meta.env.VITE_API_URL?.trim() || '/api').replace(/\/$/, '');
  const response = await fetch(`${apiBaseUrl}/auth/register`, {
    method: 'POST',
    credentials: 'omit',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new Error(readErrorMessage(errorBody));
  }
}
