import { useQuery } from '@tanstack/react-query';
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

export async function getAffiliateStats(from: string, to: string, signal?: AbortSignal, groupBy: AffiliateStatsGroupBy = 'DAY'): Promise<AffiliateStats> {
  const { data } = await httpClient.get<unknown>('/affiliate/stats', { params: { from, to, groupBy }, signal });
  return readDto<AffiliateStats>(data, ['rows', 'totals']);
}

/**
 * Statistika soatda bir yangilanadi (sotuvchi-bosh: «har soatda yangilanadi»). Bosh sahifa va
 * «Statistika» (FE-06) bir xil kalit va bir xil so'rovdan foydalanadi — raqamlar bir xil (FE-04 TC3).
 */
export function useAffiliateStatsQuery(from: string, to: string, groupBy: AffiliateStatsGroupBy = 'DAY') {
  return useQuery({
    queryKey: ['affiliate', 'stats', from, to, groupBy],
    queryFn: ({ signal }) => getAffiliateStats(from, to, signal, groupBy),
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

export async function getAffiliateLeads(params: { from: string; to: string; page: number; limit: number }, signal?: AbortSignal): Promise<Schemas['AffiliateLeadsPageDto']> {
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
