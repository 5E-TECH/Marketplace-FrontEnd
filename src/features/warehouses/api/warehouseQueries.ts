import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createWarehouse, getWarehouses, setDefaultWarehouse } from './warehouseApi';
import type { Warehouse, WarehousePayload } from '../model/warehouseTypes';

export const warehouseKey = ['inventory', 'warehouses'] as const;

export function useWarehousesQuery() {
  return useQuery({ queryKey: warehouseKey, queryFn: ({ signal }) => getWarehouses(signal) });
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
