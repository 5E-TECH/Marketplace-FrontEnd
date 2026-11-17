import { describe, expect, it } from 'vitest';
import { translations } from '../../../shared/i18n/translations';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { buildDailyStatsCsv } from './statsCsv';

const t = (key: TranslationKey) => translations.uz[key];
const row = (key: string, n: number) => ({ key, clicks: n * 10, leads: n, validLeads: n, confirmed: 1, delivered: 1, refused: 0, incomeHold: 65000, incomeAvailable: 0 });

describe('buildDailyStatsCsv (hujjat-statistika-csv)', () => {
  it('ustunlar, yangisi tepada, jami qatori va fayl nomi dizayndagidek', () => {
    const stats = { rows: [row('2027-01-13', 8), row('2027-01-14', 5)], totals: { ...row('TOTAL', 13), incomeHold: 130000 } };
    const { csv, fileName, rows } = buildDailyStatsCsv(stats, '2027-01-08', '2027-01-14', t);
    const lines = csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
    expect(lines[0]).toBe('Sana;Kliklar;Lidlar;Yaroqli;Tasdiqlangan;Yetkazilgan;Rad etilgan;Daromad;Ushlab turilgan;Mavjud');
    expect(lines[1]).toBe('14.01.2027;50;5;5;1;1;0;65000;65000;0');
    expect(lines[2]).toBe('13.01.2027;80;8;8;1;1;0;65000;65000;0');
    expect(lines[3]).toBe('Jami;130;13;13;1;1;0;130000;130000;0');
    expect(fileName).toBe('statistika_08.01-14.01.2027.csv');
    expect(rows).toBe(3);
  });
});
