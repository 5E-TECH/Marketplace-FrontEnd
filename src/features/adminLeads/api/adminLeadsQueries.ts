import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from '../../../shared/api/liveQuery';
import { operatorKeys } from '../../operator/api/operatorQueries';
import type { AdminLeadQuery } from '../model/adminLeadTypes';
import { getAdminLead, getAdminLeads, getLeadFilterOptions, getTransferOperators, releaseBooking, reopenLead, transferLead } from './adminLeadsApi';

export const adminLeadKeys = {
  all: ['admin-leads'] as const,
  list: (query: AdminLeadQuery) => ['admin-leads', 'list', query] as const,
  card: (id: string) => ['admin-leads', 'card', id] as const,
  filters: (admin: boolean) => ['admin-leads', 'filters', admin] as const,
  operators: ['admin-leads', 'operators'] as const,
};

/** Lidlar ro'yxati — jonli (har 30 s; uzilsa karkas «Jonli ulanish uzildi» bannerini ko'rsatadi). */
export function useAdminLeadsQuery(query: AdminLeadQuery) {
  return useLiveQuery({
    queryKey: adminLeadKeys.list(query),
    queryFn: ({ signal }) => getAdminLeads(query, signal),
    placeholderData: keepPreviousData,
  });
}

/** Lid kartasi — jonli (bron va suhbat holati o'zgaradi): har 15 s. */
export function useAdminLeadQuery(id: string) {
  return useLiveQuery({ queryKey: adminLeadKeys.card(id), queryFn: ({ signal }) => getAdminLead(id, signal), enabled: Boolean(id), intervalMs: 15_000 });
}

export function useLeadFilterOptionsQuery(admin: boolean) {
  return useQuery({ queryKey: adminLeadKeys.filters(admin), queryFn: ({ signal }) => getLeadFilterOptions(admin, signal), staleTime: 5 * 60_000 });
}

/** O'tkazish oynasi ochiq turganda operatorlar holati tez yangilanadi (suhbatda, bronlar). */
export function useTransferOperatorsQuery(enabled: boolean) {
  return useQuery({ queryKey: adminLeadKeys.operators, queryFn: ({ signal }) => getTransferOperators(signal), enabled, refetchInterval: enabled ? 10_000 : false });
}

function useInvalidateLeads() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: adminLeadKeys.all }),
    client.invalidateQueries({ queryKey: operatorKeys.queue }),
  ]);
}

export function useReopenLeadMutation() {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: reopenLead, onSettled: invalidate });
}

export interface TransferOutcome {
  moved: string[];
  failed: Array<{ id: string; error: unknown }>;
}

/**
 * Bir nechta lidni bitta operatorga (ommaviy amal): backendda bitta lid endpointi — ketma-ket, har biri o'z
 * natijasi bilan (bron chegarasi o'rtada to'lsa, qolganlari 409 bilan qaytadi).
 */
export function useTransferLeadsMutation() {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: async ({ ids, operatorId, reason }: { ids: readonly string[]; operatorId: string; reason?: string }): Promise<TransferOutcome> => {
      const outcome: TransferOutcome = { moved: [], failed: [] };
      for (const id of ids) {
        try {
          await transferLead({ id, operatorId, reason });
          outcome.moved.push(id);
        } catch (error) {
          outcome.failed.push({ id, error });
        }
      }
      return outcome;
    },
    onSettled: invalidate,
  });
}

/** Taklif: bronni bo'shatish — lid navbatga qaytadi (faqat admin). */
export function useReleaseBookingMutation() {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: releaseBooking, onSettled: invalidate });
}
