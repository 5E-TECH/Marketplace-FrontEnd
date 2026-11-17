import { describe, expect, it } from 'vitest';
import { buildCsv, CSV_BOM, csvFileName, formatCsvDate } from './csv';

describe('buildCsv (hujjat-statistika-csv)', () => {
  const columns = [
    { header: 'Sana', value: (row: { day: string; income: number; note?: string }) => formatCsvDate(row.day) },
    { header: 'Daromad', value: (row: { day: string; income: number; note?: string }) => row.income },
    { header: 'Izoh', value: (row: { day: string; income: number; note?: string }) => row.note },
  ];

  it('UTF-8 BOM, «;» ajratgich, CRLF va butun sonlar', () => {
    const csv = buildCsv(columns, [{ day: '2027-01-14', income: 151250 }, { day: '2027-01-13', income: -65000.4 }]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual(['Sana;Daromad;Izoh', '14.01.2027;151250;', '13.01.2027;-65000;', '']);
  });

  it('ajratgich, qo‘shtirnoq yoki qator uzilishi bor matn qo‘shtirnoqqa olinadi', () => {
    const csv = buildCsv(columns, [{ day: '2027-01-14', income: 0, note: 'a;b "c"\nd' }]);
    expect(csv).toContain('14.01.2027;0;"a;b ""c""\nd"');
  });

  it('formula bilan boshlangan matn jadval dasturida ishga tushmaydi (CSV injection)', () => {
    const csv = buildCsv(columns, [{ day: '2027-01-14', income: 1, note: '=HYPERLINK("x")' }]);
    expect(csv).toContain(`;"'=HYPERLINK(""x"")"`);
  });
});

describe('csvFileName', () => {
  it('bir yil ichida: statistika_08.01-14.01.2027.csv', () => {
    expect(csvFileName('statistika', '2027-01-08', '2027-01-14')).toBe('statistika_08.01-14.01.2027.csv');
  });
  it('yil almashganda ikkala sanada ham yil', () => {
    expect(csvFileName('lidlar', '2026-12-28', '2027-01-03')).toBe('lidlar_28.12.2026-03.01.2027.csv');
  });
  it('bitta kun', () => {
    expect(csvFileName('statistika', '2027-01-14', '2027-01-14')).toBe('statistika_14.01.2027.csv');
  });
});
