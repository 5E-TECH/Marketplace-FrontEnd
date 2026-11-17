import { useQuery } from '@tanstack/react-query';
import type { components } from '../../../generated/api-types';
import { httpClient } from '../../../shared/api/httpClient';
import { readDto } from '../../../shared/api/readDto';

/** Sotuvchi kabineti API (BE-25: /affiliate/*). */
type Schemas = components['schemas'];
export type AffiliateStats = Schemas['AffiliateStatsDto'];
export type AffiliateStatsRow = Schemas['AffiliateStatsRowDto'];

export async function getAffiliateStats(from: string, to: string, signal?: AbortSignal): Promise<AffiliateStats> {
  const { data } = await httpClient.get<unknown>('/affiliate/stats', { params: { from, to, groupBy: 'DAY' }, signal });
  return readDto<AffiliateStats>(data, ['rows', 'totals']);
}

/** Statistika soatda bir yangilanadi (sotuvchi-bosh: «har soatda yangilanadi»). */
export function useAffiliateStatsQuery(from: string, to: string) {
  return useQuery({
    queryKey: ['affiliate', 'stats', from, to],
    queryFn: ({ signal }) => getAffiliateStats(from, to, signal),
    staleTime: 5 * 60_000,
  });
}
