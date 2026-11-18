import type { AffiliateStats, AffiliateStatsRow } from '../api/affiliateApi';

/**
 * Statistika hisoblari — bosh sahifa (FE-04) va «Statistika» (FE-06) shu funksiyalardan
 * foydalanadi, shuning uchun bir kunning raqamlari ikki sahifada bir xil (FE-04 TC3).
 */

/** Daromad = ushlab turilgan + mavjud (yetkazilgan buyurtmalar haqi, so'm). */
export const statsIncome = (row: Pick<AffiliateStatsRow, 'incomeHold' | 'incomeAvailable'>) => row.incomeHold + row.incomeAvailable;

export const emptyStatsRow = (key: string): AffiliateStatsRow => ({
  key, clicks: 0, leads: 0, validLeads: 0, confirmed: 0, delivered: 0, refused: 0, incomeHold: 0, incomeAvailable: 0,
});

/** Berilgan kun qatori; server qatorni bermasa (faoliyat yo'q) — nollar. */
export function statsForDay(stats: AffiliateStats | undefined, day: string): AffiliateStatsRow | undefined {
  if (!stats) return undefined;
  return stats.rows.find((row) => row.key === day) ?? emptyStatsRow(day);
}

/** `from`…`to` oralig'idagi har kun (bo'sh kun ham) — grafik va jadval uchun, eskisidan yangisiga. */
export function statsDays(stats: AffiliateStats | undefined, days: readonly string[]): AffiliateStatsRow[] {
  return days.map((day) => statsForDay(stats, day) ?? emptyStatsRow(day));
}
