import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from '../../../shared/api/liveQuery';
import { getWarehouseStock } from '../../inbound/api/inboundApi';
import { inboundKeys, warehouseStockKey } from '../../inbound/api/inboundQueries';
import {
  createWholesaler,
  getAllWholesalers,
  getWholesaler,
  getWholesalerAttention,
  getWholesalerActs,
  getWholesalerAudit,
  getWholesalerSettlements,
  getWholesalerDocuments,
  inviteWholesalerOwner,
  reviewBankChange,
  reviewWholesaler,
  sendWholesalerAct,
  updateWholesaler,
  uploadWholesalerContract,
} from './wholesalersApi';

export const wholesalerKeys = {
  all: ['wholesalers'] as const,
  list: ['wholesalers', 'list'] as const,
  card: (id: string) => ['wholesalers', 'card', id] as const,
  documents: (id: string) => ['wholesalers', 'documents', id] as const,
  attention: ['wholesalers', 'attention'] as const,
  acts: (id: string) => ['wholesalers', 'acts', id] as const,
  settlements: (id: string) => ['wholesalers', 'settlements', id] as const,
  audit: (id: string) => ['wholesalers', 'audit', id] as const,
};

export function useWholesalerSettlementsQuery(id: string) {
  return useQuery({ queryKey: wholesalerKeys.settlements(id), queryFn: ({ signal }) => getWholesalerSettlements(id, signal), enabled: Boolean(id) });
}

export function useWholesalerAuditQuery(id: string) {
  return useQuery({ queryKey: wholesalerKeys.audit(id), queryFn: ({ signal }) => getWholesalerAudit(id, signal), enabled: Boolean(id) });
}

/** Ro'yxat — jonli (ombor va moliya raqamlari o'zgaradi): har 60 s. */
export function useWholesalersQuery() {
  return useLiveQuery({ queryKey: wholesalerKeys.list, queryFn: ({ signal }) => getAllWholesalers(signal), intervalMs: 60_000 });
}

export function useWholesalerQuery(id: string) {
  return useLiveQuery({ queryKey: wholesalerKeys.card(id), queryFn: ({ signal }) => getWholesaler(id, signal), enabled: Boolean(id), intervalMs: 60_000 });
}

export function useWholesalerAttentionQuery() {
  return useLiveQuery({ queryKey: wholesalerKeys.attention, queryFn: ({ signal }) => getWholesalerAttention(signal), intervalMs: 60_000 });
}

export function useWholesalerDocumentsQuery(id: string, enabled = true) {
  return useQuery({ queryKey: wholesalerKeys.documents(id), queryFn: ({ signal }) => getWholesalerDocuments(id, signal), enabled: enabled && Boolean(id) });
}

/** Optovik SKU larining ombordagi qoldig'i (BE-16 `GET /admin/inventory/stock?shopId`) — kartadagi mahsulotlar jadvali. */
export function useWholesalerStockQuery(id: string) {
  return useLiveQuery({ queryKey: [...warehouseStockKey, 'shop', id], queryFn: ({ signal }) => getWarehouseStock({ shopId: id }, signal), enabled: Boolean(id), intervalMs: 60_000 });
}

export function useWholesalerActsQuery(id: string, enabled = true) {
  return useQuery({ queryKey: wholesalerKeys.acts(id), queryFn: ({ signal }) => getWholesalerActs(id, signal), enabled: enabled && Boolean(id) });
}

/** Optovik o'zgarsa ro'yxat, karta va postavka formasidagi optovik tanlovi (FE-16) ham yangilanadi. */
function useInvalidateWholesalers() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: wholesalerKeys.all }),
    client.invalidateQueries({ queryKey: inboundKeys.wholesalers }),
  ]);
}

export function useCreateWholesalerMutation() {
  const invalidate = useInvalidateWholesalers();
  return useMutation({ mutationFn: createWholesaler, onSuccess: invalidate });
}

export function useUpdateWholesalerMutation() {
  const invalidate = useInvalidateWholesalers();
  return useMutation({ mutationFn: updateWholesaler, onSuccess: invalidate });
}

export function useUploadContractMutation() {
  const invalidate = useInvalidateWholesalers();
  return useMutation({ mutationFn: uploadWholesalerContract, onSuccess: invalidate });
}

export function useReviewWholesalerMutation() {
  const invalidate = useInvalidateWholesalers();
  return useMutation({ mutationFn: reviewWholesaler, onSuccess: invalidate });
}

export function useInviteOwnerMutation() {
  const invalidate = useInvalidateWholesalers();
  return useMutation({ mutationFn: inviteWholesalerOwner, onSuccess: invalidate });
}

export function useSendActMutation() {
  const invalidate = useInvalidateWholesalers();
  return useMutation({ mutationFn: sendWholesalerAct, onSuccess: invalidate });
}

export function useReviewBankChangeMutation() {
  const invalidate = useInvalidateWholesalers();
  return useMutation({ mutationFn: reviewBankChange, onSuccess: invalidate });
}
