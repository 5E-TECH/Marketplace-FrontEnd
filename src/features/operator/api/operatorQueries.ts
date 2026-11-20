import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useLiveQuery } from '../../../shared/api/liveQuery';
import type { LeadCard, LeadResultInput, WhereDeliver } from '../model/operatorTypes';
import {
  confirmLeadAddress,
  getLeadCard,
  getOperatorAttempts,
  getLeadProduct,
  getOperatorLeads,
  getOperatorState,
  getOperatorStats,
  getQueueSummary,
  submitLeadResult,
  quoteLeadPrice,
  takeNextLead,
  updateOperatorState,
  type OperatorState,
} from './operatorApi';

export const operatorKeys = {
  all: ['operator'] as const,
  state: ['operator', 'state'] as const,
  leads: ['operator', 'leads'] as const,
  lead: (id: string) => ['operator', 'lead', id] as const,
  product: (id: string) => ['operator', 'lead', id, 'product'] as const,
  queue: ['operator', 'queue-summary'] as const,
  stats: (from: string, to: string) => ['operator', 'stats', from, to] as const,
  attempts: (from: string, to: string) => ['operator', 'attempts', from, to] as const,
};

/** Bron 10 daqiqa — ro'yxat tez-tez yangilanadi. */
const LEADS_INTERVAL_MS = 15_000;
export const DEFAULT_MAX_BOOKINGS = 5;

export function useOperatorLeadsQuery() {
  return useLiveQuery({ queryKey: operatorKeys.leads, queryFn: ({ signal }) => getOperatorLeads(signal), intervalMs: LEADS_INTERVAL_MS });
}

export function useOperatorStatsQuery(from: string, to: string) {
  return useLiveQuery({ queryKey: operatorKeys.stats(from, to), queryFn: ({ signal }) => getOperatorStats(from, to, signal), intervalMs: 60_000 });
}

/** «Bugungi urinishlarim · oxirgi 10 tasi, jami 38» (operator-bosh). */
export function useOperatorAttemptsQuery(from: string, to: string) {
  return useLiveQuery({ queryKey: operatorKeys.attempts(from, to), queryFn: ({ signal }) => getOperatorAttempts(from, to, 10, signal), intervalMs: 60_000 });
}

/** Buyurtma formasi: miqdor yoki yetkazish o'zgarsa — server summasi. */
export function useLeadQuoteMutation() {
  return useMutation({
    mutationFn: ({ id, quantity, whereDeliver }: { id: string; quantity: number; whereDeliver: WhereDeliver }) => quoteLeadPrice(id, quantity, whereDeliver),
  });
}

/** «Navbatda: N ta lid» — yangi ariza kelsa «Keyingi lid» o'zi yonadi (sahifani yangilash shart emas). */
export function useQueueSummaryQuery() {
  return useLiveQuery({ queryKey: operatorKeys.queue, queryFn: ({ signal }) => getQueueSummary(signal), intervalMs: LEADS_INTERVAL_MS });
}

/**
 * Joriy holat — taklif qilingan `GET /operator/state` dan (BE-13). Backendda hali yo'q
 * bo'lsa so'rov yiqiladi va holat «Oflayn» deb ko'rinadi: o'zgartirilgan javob
 * (`PUT`) baribir keshga yoziladi.
 */
export function useOperatorStateQuery() {
  return useQuery({
    queryKey: operatorKeys.state,
    queryFn: ({ signal }) => getOperatorState(signal),
    retry: 1,
    refetchInterval: 30_000,
  });
}

/** Lid kartasi. «Keyingi lid» javobi keshga darhol yoziladi — karta 1 soniyada (OPR-2). */
export function useLeadCardQuery(id: string | null) {
  return useQuery({
    queryKey: operatorKeys.lead(id ?? ''),
    queryFn: ({ signal }) => getLeadCard(id ?? '', signal),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useLeadProductQuery(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: operatorKeys.product(id ?? ''),
    queryFn: ({ signal }) => getLeadProduct(id ?? '', signal),
    enabled: Boolean(id) && enabled,
    staleTime: 5 * 60_000,
  });
}

/** Navbat, bronlar va holat birga o'zgaradi — bittasi yangilansa hammasi. */
function refreshQueue(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: operatorKeys.leads });
  void queryClient.invalidateQueries({ queryKey: operatorKeys.state });
  void queryClient.invalidateQueries({ queryKey: operatorKeys.queue });
}

export function useOperatorStateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (state: OperatorState) => updateOperatorState(state),
    onSuccess: (info) => {
      queryClient.setQueryData(operatorKeys.state, info);
      void queryClient.invalidateQueries({ queryKey: operatorKeys.leads });
      void queryClient.invalidateQueries({ queryKey: operatorKeys.queue });
    },
  });
}

export function useTakeNextLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: takeNextLead,
    onSuccess: (card) => {
      queryClient.setQueryData(operatorKeys.lead(card.id), card);
      refreshQueue(queryClient);
    },
  });
}

export function useSubmitLeadResultMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LeadResultInput }) => submitLeadResult(id, input),
    onSuccess: (_result, { id }) => {
      queryClient.removeQueries({ queryKey: operatorKeys.lead(id), exact: true });
      refreshQueue(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['operator', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['operator', 'attempts'] });
    },
  });
}

/** «Buyurtmani tasdiqlash»: avval manzil tasdig'i, keyin natija — server tasdiqsiz manzilni rad etadi. */
export function useConfirmOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ card, comment, quantity, whereDeliver }: { card: LeadCard; comment?: string; quantity: number; whereDeliver: WhereDeliver }) => {
      if (card.address && (!card.address.confirmedAt || card.address.whereDeliver !== whereDeliver)) {
        const updated = await confirmLeadAddress(card.id, card.address, whereDeliver);
        queryClient.setQueryData(operatorKeys.lead(card.id), updated);
      }
      return submitLeadResult(card.id, { outcome: 'CONFIRMED', quantity, ...(comment ? { comment } : {}) });
    },
    onSuccess: (_result, { card }) => {
      queryClient.removeQueries({ queryKey: operatorKeys.lead(card.id), exact: true });
      refreshQueue(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['operator', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['operator', 'attempts'] });
    },
  });
}
