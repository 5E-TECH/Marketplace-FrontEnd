import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from '../../../shared/api/liveQuery';
import { getOperatorLeads, getOperatorStats, updateOperatorState, type OperatorState, type OperatorStateInfo } from './operatorApi';

export const operatorKeys = {
  all: ['operator'] as const,
  state: ['operator', 'state'] as const,
  leads: ['operator', 'leads'] as const,
  stats: (from: string, to: string) => ['operator', 'stats', from, to] as const,
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

/**
 * Joriy holat. Backendda o'qish endpointi yo'q (faqat `PUT /operator/state`) — holat
 * o'zgartirilgan javobdan olinadi; sahifa yangilansa «Oflayn» dan boshlanadi.
 */
export function useOperatorStateQuery() {
  return useQuery<OperatorStateInfo | null>({
    queryKey: operatorKeys.state,
    queryFn: () => null,
    initialData: null,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useOperatorStateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (state: OperatorState) => updateOperatorState(state),
    onSuccess: (info) => {
      queryClient.setQueryData(operatorKeys.state, info);
      void queryClient.invalidateQueries({ queryKey: operatorKeys.leads });
    },
  });
}

