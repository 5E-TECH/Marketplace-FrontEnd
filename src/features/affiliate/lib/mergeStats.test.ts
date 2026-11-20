import { describe, expect, it } from 'vitest';
import type { AffiliateStatsRow } from '../api/affiliateApi';
import { mergeStats } from './mergeStats';

const row = (key: string, value: number): AffiliateStatsRow => ({
  key, clicks: value, leads: value, validLeads: value, confirmed: value, delivered: value, refused: 0, incomeHold: value * 10, incomeAvailable: value * 100,
});

describe('mergeStats («Mahsulot» = uning sahifalari)', () => {
  it('bir xil kunlar qo‘shiladi, jami — yig‘indi', () => {
    const merged = mergeStats([
      { rows: [row('2027-01-13', 1), row('2027-01-14', 2)], totals: row('TOTAL', 3) },
      { rows: [row('2027-01-14', 5)], totals: row('TOTAL', 5) },
    ]);
    expect(merged.rows.map((item) => [item.key, item.clicks, item.incomeAvailable])).toEqual([['2027-01-13', 1, 100], ['2027-01-14', 7, 700]]);
    expect(merged.totals.leads).toBe(8);
    expect(merged.totals.incomeHold).toBe(80);
  });

  it('bo‘sh ro‘yxat — nol jami', () => {
    expect(mergeStats([]).totals.clicks).toBe(0);
  });
});
