import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type { ManagedUser, UpdateUserPayload, UserUpsertPayload } from '../model/userTypes';

function parseOperator(value: unknown): ManagedUser {
  if (typeof value !== 'object' || value === null) throw new Error('Operator ma’lumoti noto‘g‘ri formatda');
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== 'string' ||
    item.role !== 'OPERATOR' ||
    typeof item.name !== 'string' ||
    typeof item.phone !== 'string' ||
    typeof item.isActive !== 'boolean' ||
    typeof item.isBlocked !== 'boolean' ||
    typeof item.shopId !== 'string' ||
    typeof item.createdAt !== 'string' ||
    typeof item.updatedAt !== 'string' ||
    typeof item.isDeleted !== 'boolean'
  ) throw new Error('Operatorning majburiy maydonlari mavjud emas');
  return {
    id: item.id,
    name: item.name,
    phone: item.phone,
    avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : null,
    role: 'OPERATOR',
    isActive: item.isActive,
    isBlocked: item.isBlocked,
    shopId: item.shopId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    isDeleted: item.isDeleted,
  };
}

export async function getUsers(signal?: AbortSignal): Promise<ManagedUser[]> {
  const { data } = await httpClient.get<unknown>('/sellers/operators', { signal });
  const value = unwrapApiData(data);
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const list = Array.isArray(value) ? value : Array.isArray(record.items) ? record.items : Array.isArray(record.operators) ? record.operators : null;
  if (!list) throw new Error('Operatorlar ro‘yxati noto‘g‘ri formatda');
  return list.map(parseOperator);
}

export async function createUser(payload: UserUpsertPayload): Promise<ManagedUser> {
  const { data } = await httpClient.post<unknown>('/sellers/operators', {
    name: payload.name,
    phone: payload.phone,
    password: payload.password,
  });
  return parseOperator(unwrapApiData(data));
}

export async function deleteUser(id: string): Promise<void> {
  await httpClient.delete(`/sellers/operators/${encodeURIComponent(id)}`);
}

export async function updateUser({ id, name, phone, password }: UpdateUserPayload): Promise<ManagedUser> {
  const { data } = await httpClient.patch<unknown>(
    `/sellers/operators/${encodeURIComponent(id)}`,
    { name, phone, ...(password ? { password } : {}) },
  );
  return parseOperator(unwrapApiData(data));
}
