import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readPagination, readText } from '../../../shared/api/responseFields';
import type { AdminUser, AdminUserListParams, AdminUserRole, AdminUsersPage } from '../model/adminUserTypes';

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
    role: role as AdminUserRole,
    blocked: row.blocked === true || row.isBlocked === true || row.isActive === false,
    createdAt: readText(row, 'createdAt'),
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
  await httpClient.post(`/admin/users/${encodeURIComponent(id)}/${blocked ? 'block' : 'unblock'}`);
}
