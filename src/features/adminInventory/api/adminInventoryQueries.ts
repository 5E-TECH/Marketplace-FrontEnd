import { useQuery } from '@tanstack/react-query';
import { getAdminStock, getAdminStockMovements } from './adminInventoryApi';
import type { AdminMovementListParams, AdminStockListParams } from '../model/adminInventoryTypes';

export const adminInventoryKeys = {
  all: ['admin-inventory'] as const,
  stock: (params: AdminStockListParams) => [...adminInventoryKeys.all, 'stock', params] as const,
  movements: (params: AdminMovementListParams) => [...adminInventoryKeys.all, 'movements', params] as const,
};

export const useAdminStockQuery = (params: AdminStockListParams, enabled = true) => useQuery({
  queryKey: adminInventoryKeys.stock(params),
  queryFn: ({ signal }) => getAdminStock(params, signal),
  placeholderData: (previous) => previous,
  enabled,
});

export const useAdminStockMovementsQuery = (params: AdminMovementListParams, enabled = true) => useQuery({
  queryKey: adminInventoryKeys.movements(params),
  queryFn: ({ signal }) => getAdminStockMovements(params, signal),
  placeholderData: (previous) => previous,
  enabled,
});
