import { describe, expect, it } from 'vitest';
import type { AffiliateStats } from '../api/affiliateApi';
import { emptyStatsRow, statsDays, statsForDay, statsIncome } from './statsSummary';

const row = (key: string, leads: number, hold: number, available: number) => ({ ...emptyStatsRow(key), leads, incomeHold: hold, incomeAvailable: available });

describe('statistika hisobi — bosh sahifa va FE-06 uchun bitta manba (FE-04 TC3)', () => {
  const stats: AffiliateStats = { rows: [row('2027-01-13', 4, 65_000, 0), row('2027-01-14', 5, 86_250, 65_000)], totals: row('TOTAL', 9, 151_250, 65_000) };

  it('daromad = ushlab turilgan + mavjud', () => {
    expect(statsIncome(stats.rows[1])).toBe(151_250);
  });

  it('kun qatori; faoliyat bo‘lmagan kun — nollar, yuklanmagan — undefined', () => {
    expect(statsForDay(stats, '2027-01-14')?.leads).toBe(5);
    expect(statsForDay(stats, '2027-01-12')).toEqual(emptyStatsRow('2027-01-12'));
    expect(statsForDay(undefined, '2027-01-14')).toBeUndefined();
  });

  it('har kun tartib bilan, bo‘sh kun ham', () => {
    expect(statsDays(stats, ['2027-01-12', '2027-01-13', '2027-01-14']).map((day) => day.leads)).toEqual([0, 4, 5]);
  });
});
