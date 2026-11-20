import type { AffiliateStatsGroupBy } from '../../../features/affiliate/api/affiliateApi';

/**
 * «Statistika» sahifasi kesimi (sotuvchi-statistika): davr, kesim va sahifa filtri URL'da —
 * yangilansa yoki havola ulashilsa saqlanadi (`?period=last7&cut=STREAM&page=3301`). Davr — `statsPeriod`.
 */

export const STATS_CUTS = ['DAY', 'STREAM', 'SUB1'] as const satisfies readonly AffiliateStatsGroupBy[];
export type StatsCut = (typeof STATS_CUTS)[number];

export const parseCut = (value: string | null): StatsCut =>
  (STATS_CUTS as readonly string[]).includes(value ?? '') ? (value as StatsCut) : 'DAY';
