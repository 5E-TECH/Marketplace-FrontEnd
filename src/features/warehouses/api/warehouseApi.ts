import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type { Warehouse, WarehousePayload } from '../model/warehouseTypes';

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseWarehouse(value: unknown): Warehouse {
  const item = unwrapApiData(value);
  if (typeof item !== 'object' || item === null || !('id' in item) || (typeof item.id !== 'string' && typeof item.id !== 'number') || !('name' in item) || typeof item.name !== 'string') {
    throw new Error('Ombor serverdan noto‘g‘ri formatda keldi');
  }
  return {
    id: String(item.id),
    ownerId: 'ownerId' in item && typeof item.ownerId === 'string' ? item.ownerId : '',
    name: item.name,
    regionId: nullableString('regionId' in item ? item.regionId : null),
    districtId: nullableString('districtId' in item ? item.districtId : null),
    address: nullableString('address' in item ? item.address : null),
    isDefault: 'isDefault' in item && item.isDefault === true,
    isActive: !('isActive' in item) || item.isActive === true,
    createdAt: 'createdAt' in item && typeof item.createdAt === 'string' ? item.createdAt : '',
    updatedAt: 'updatedAt' in item && typeof item.updatedAt === 'string' ? item.updatedAt : '',
  };
}

export async function getWarehouses(signal?: AbortSignal): Promise<Warehouse[]> {
  const { data } = await httpClient.get<unknown>('/inventory/warehouses', { signal });
  const list = unwrapApiData(data);
  if (!Array.isArray(list)) throw new Error('Omborlar ro‘yxati noto‘g‘ri formatda keldi');
  return list.map(parseWarehouse);
}

export async function createWarehouse(payload: WarehousePayload): Promise<Warehouse> {
  const { data } = await httpClient.post<unknown>('/inventory/warehouses', payload);
  return parseWarehouse(data);
}

export async function getWarehouse(id: string, signal?: AbortSignal): Promise<Warehouse> {
  const { data } = await httpClient.get<unknown>(`/inventory/warehouses/${encodeURIComponent(id)}`, { signal });
  return parseWarehouse(data);
}

export async function updateWarehouse(id: string, payload: WarehousePayload): Promise<Warehouse> {
  const { data } = await httpClient.patch<unknown>(`/inventory/warehouses/${encodeURIComponent(id)}`, payload);
  return parseWarehouse(data);
}

export async function deleteWarehouse(id: string): Promise<void> {
  await httpClient.delete(`/inventory/warehouses/${encodeURIComponent(id)}`);
}

export async function setDefaultWarehouse(id: string): Promise<Warehouse> {
  const { data } = await httpClient.patch<unknown>(`/inventory/warehouses/${encodeURIComponent(id)}`, { isDefault: true });
  return parseWarehouse(data);
}
