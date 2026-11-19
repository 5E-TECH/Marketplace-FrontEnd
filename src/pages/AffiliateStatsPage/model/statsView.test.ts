import { describe, expect, it } from 'vitest';
import { formatRange, parseCut, parsePeriod, periodDays, periodRange, signedMoney } from './statsView';

describe('statsView — davr, kesim, summa', () => {
  it('davr chegaralari (bugun 14.01.2027)', () => {
    const today = '2027-01-14';
    expect(periodRange('today', today)).toEqual({ from: today, to: today });
    expect(periodRange('yesterday', today)).toEqual({ from: '2027-01-13', to: '2027-01-13' });
    expect(periodRange('last7', today)).toEqual({ from: '2027-01-08', to: today });
    expect(periodRange('last30', today)).toEqual({ from: '2026-12-16', to: today });
    expect(periodRange('thisMonth', today)).toEqual({ from: '2027-01-01', to: today });
    expect(periodRange('lastMonth', today)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(periodDays('2027-01-08', '2027-01-14')).toHaveLength(7);
  });

  it('URL qiymati noto‘g‘ri bo‘lsa — sukut', () => {
    expect(parsePeriod('xyz')).toBe('last7');
    expect(parsePeriod(null)).toBe('last7');
    expect(parseCut('SUB1')).toBe('SUB1');
    expect(parseCut('SUB2')).toBe('DAY');
  });

  it('davr yozuvi va manfiy summa (U+2212)', () => {
    expect(formatRange('2027-01-08', '2027-01-14')).toBe('08.01–14.01.2027');
    expect(formatRange('2026-12-28', '2027-01-03')).toBe('28.12.2026–03.01.2027');
    expect(formatRange('2027-01-14', '2027-01-14')).toBe('14.01.2027');
    expect(signedMoney(-65000)).toBe('−65 000');
    expect(signedMoney(151250)).toBe('151 250');
  });
});
