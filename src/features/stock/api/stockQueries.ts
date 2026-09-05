import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adjustStock, getStock, inboundStock } from './stockApi';
import type { StockAdjustPayload, StockInboundPayload, StockListParams } from '../model/stockTypes';

export const stockKey = ['inventory', 'stock'] as const;

export function useStockQuery(params: StockListParams) {
  return useQuery({ queryKey: [...stockKey, params], queryFn: ({ signal }) => getStock(params, signal), placeholderData: (previous) => previous });
}

export function useInboundStockMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (payload: StockInboundPayload) => inboundStock(payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: stockKey }) });
}

export function useAdjustStockMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (payload: StockAdjustPayload) => adjustStock(payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: stockKey }) });
}
