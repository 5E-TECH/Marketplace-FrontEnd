import { useQueries, useQuery } from '@tanstack/react-query';
import type { components } from '../../../generated/api-types';
import { httpClient } from '../../../shared/api/httpClient';
import { readDto } from '../../../shared/api/readDto';

/** Sotuvchi kabineti API (BE-25: /affiliate/*). */
type Schemas = components['schemas'];
export type AffiliateStats = Schemas['AffiliateStatsDto'];
export type AffiliateStatsRow = Schemas['AffiliateStatsRowDto'];

export type AffiliateStream = Schemas['AffiliateStreamDto'];
/** DAY — kunlar, STREAM — sahifalar (kalit = sahifa kodi), SUB1 — reklama belgisi. */
export type AffiliateStatsGroupBy = 'DAY' | 'STREAM' | 'SUB1';

export async function getAffiliateStats(
  from: string,
  to: string,
  signal?: AbortSignal,
  groupBy: AffiliateStatsGroupBy = 'DAY',
  streamId?: string,
): Promise<AffiliateStats> {
  const params = { from, to, groupBy, ...(streamId ? { streamId } : {}) };
  const { data } = await httpClient.get<unknown>('/affiliate/stats', { params, signal });
  return readDto<AffiliateStats>(data, ['rows', 'totals']);
}

/**
 * Statistika soatda bir yangilanadi (sotuvchi-bosh: «har soatda yangilanadi»). Bosh sahifa va
 * «Statistika» (FE-06) bir xil kalit va bir xil so'rovdan foydalanadi — raqamlar bir xil (FE-04 TC3).
 */
export function useAffiliateStatsQuery(from: string, to: string, groupBy: AffiliateStatsGroupBy = 'DAY', streamId?: string) {
  return useQuery({
    // Sahifa filtri bo'lmasa kalit bosh sahifadagidek — kesh umumiy (FE-04 TC3).
    queryKey: streamId ? ['affiliate', 'stats', from, to, groupBy, streamId] : ['affiliate', 'stats', from, to, groupBy],
    queryFn: ({ signal }) => getAffiliateStats(from, to, signal, groupBy, streamId),
    staleTime: 5 * 60_000,
  });
}

export async function getAffiliateStreams(params: { page: number; limit: number }, signal?: AbortSignal): Promise<Schemas['AffiliateStreamsPageDto']> {
  const { data } = await httpClient.get<unknown>('/affiliate/streams', { params, signal });
  return readDto<Schemas['AffiliateStreamsPageDto']>(data, ['items', 'total']);
}

/** Sotuvchi sahifalari (eng ko'pi 100 — bosh sahifadagi jadval va «Birinchi qadamlar» uchun). */
export function useAffiliateStreamsQuery() {
  return useQuery({
    queryKey: ['affiliate', 'streams', { page: 1, limit: 100 }],
    queryFn: ({ signal }) => getAffiliateStreams({ page: 1, limit: 100 }, signal),
    staleTime: 60_000,
  });
}

export type AffiliateLead = Schemas['AffiliateLeadRowDto'];
export type AffiliateLeadStatus = AffiliateLead['status'];

export interface AffiliateLeadsParams {
  from: string;
  to: string;
  page: number;
  limit: number;
  streamId?: string;
}

export async function getAffiliateLeads(params: AffiliateLeadsParams, signal?: AbortSignal): Promise<Schemas['AffiliateLeadsPageDto']> {
  const { data } = await httpClient.get<unknown>('/affiliate/leads', { params, signal });
  return readDto<Schemas['AffiliateLeadsPageDto']>(data, ['items', 'total']);
}

/** Kun bo'yicha lidlar (eng ko'pi 100) — bosh sahifadagi «Bugun kelgan N lid» holatlari uchun. */
export function useAffiliateLeadsQuery(from: string, to: string) {
  return useQuery({
    queryKey: ['affiliate', 'leads', { from, to, page: 1, limit: 100 }],
    queryFn: ({ signal }) => getAffiliateLeads({ from, to, page: 1, limit: 100 }, signal),
    staleTime: 60_000,
  });
}

/** Bitta eksportda eng ko'pi shuncha sahifa (100 tadan) — 5 000 lid; undan ko'pi uchun davrni qisqartirish kerak. */
export const LEADS_EXPORT_MAX_PAGES = 50;

/**
 * CSV uchun davrdagi barcha lidlar (FE-06 TC2): sahifalab, 100 tadan. Raqam serverdan faqat
 * `****4567` bo'lib keladi — to'liq raqam frontendga umuman kelmaydi (SOT-4).
 */
export async function fetchAllAffiliateLeads(
  params: { from: string; to: string; streamId?: string },
  signal?: AbortSignal,
): Promise<{ items: AffiliateLead[]; total: number; truncated: boolean }> {
  const items: AffiliateLead[] = [];
  let page = 1;
  let totalPages: number;
  let total: number;
  do {
    const result = await getAffiliateLeads({ ...params, page, limit: 100 }, signal);
    items.push(...result.items);
    total = result.total;
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages && page <= LEADS_EXPORT_MAX_PAGES);
  return { items, total, truncated: items.length < total };
}

/**
 * Bir nechta sahifa bo'yicha statistika («Mahsulot» filtri): har sahifa — alohida so'rov (kalit
 * `useAffiliateStatsQuery` bilan bir xil, kesh umumiy), natija `mergeStats` bilan yig'iladi.
 * `streamIds` bo'sh — filtrsiz bitta so'rov.
 */
export function useAffiliateStatsForStreams(from: string, to: string, groupBy: AffiliateStatsGroupBy, streamIds: readonly string[], merge: (list: AffiliateStats[]) => AffiliateStats) {
  const ids: (string | undefined)[] = streamIds.length ? [...streamIds] : [undefined];
  return useQueries({
    queries: ids.map((streamId) => ({
      queryKey: streamId ? ['affiliate', 'stats', from, to, groupBy, streamId] : ['affiliate', 'stats', from, to, groupBy],
      queryFn: ({ signal }: { signal: AbortSignal }) => getAffiliateStats(from, to, signal, groupBy, streamId),
      staleTime: 5 * 60_000,
    })),
    combine: (results) => {
      const failed = results.find((result) => result.isError);
      const ready = results.every((result) => result.data);
      return {
        data: ready ? (results.length === 1 ? results[0].data : merge(results.map((result) => result.data as AffiliateStats))) : undefined,
        isError: Boolean(failed),
        isPending: results.some((result) => result.isPending),
        error: failed?.error ?? null,
        dataUpdatedAt: Math.min(...results.map((result) => result.dataUpdatedAt)),
        refetch: () => Promise.all(results.map((result) => result.refetch())),
      };
    },
  });
}
