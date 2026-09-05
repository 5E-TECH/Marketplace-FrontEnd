import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createWarehouse, deleteWarehouse, getWarehouse, getWarehouses, setDefaultWarehouse, updateWarehouse } from './warehouseApi';
import type { Warehouse, WarehousePayload } from '../model/warehouseTypes';

export const warehouseKey = ['inventory', 'warehouses'] as const;
export const warehouseDetailKey = (id: string) => [...warehouseKey, id] as const;

export function useWarehousesQuery() {
  return useQuery({ queryKey: warehouseKey, queryFn: ({ signal }) => getWarehouses(signal) });
}

export const useWarehouseQuery = (id: string | null) => useQuery({ queryKey: warehouseDetailKey(id ?? ''), queryFn: ({ signal }) => getWarehouse(id as string, signal), enabled: Boolean(id) });

export function useUpdateWarehouseMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: WarehousePayload }) => updateWarehouse(id, payload), onSuccess: (updated) => { client.setQueryData(warehouseDetailKey(updated.id), updated); client.setQueryData<Warehouse[]>(warehouseKey, (items = []) => items.map((item) => item.id === updated.id ? updated : updated.isDefault ? { ...item, isDefault: false } : item)); } });
}

export function useDeleteWarehouseMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteWarehouse, onSuccess: (_value, id) => { client.removeQueries({ queryKey: warehouseDetailKey(id) }); client.setQueryData<Warehouse[]>(warehouseKey, (items = []) => items.filter((item) => item.id !== id)); } });
}

export function useCreateWarehouseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WarehousePayload) => createWarehouse(payload),
    onSuccess: (created) => queryClient.setQueryData<Warehouse[]>(warehouseKey, (items = []) => [
      ...items.map((item) => created.isDefault ? { ...item, isDefault: false } : item),
      created,
    ]),
  });
}

export function useSetDefaultWarehouseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setDefaultWarehouse(id),
    onSuccess: (updated) => queryClient.setQueryData<Warehouse[]>(warehouseKey, (items = []) =>
      items.map((item) => ({ ...item, isDefault: item.id === updated.id })),
    ),
  });
}
