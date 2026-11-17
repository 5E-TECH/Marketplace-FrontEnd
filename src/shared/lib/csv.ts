/**
 * CSV yozish (hujjat-statistika-csv, umumiy-eksport). Format Excel va Google Sheets
 * uchun: UTF-8 BOM (o'zbek harflari to'g'ri chiqadi), ajratgich nuqtali vergul «;»,
 * qator oxiri CRLF. Sonlar butun, bo'shliqsiz — jadval dasturida qo'shiladi.
 */
export const CSV_BOM = '﻿';
export const CSV_SEPARATOR = ';';
const LINE_BREAK = '\r\n';

export type CsvValue = string | number | null | undefined;

export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => CsvValue;
}

function formatCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  // Sonlar butun va bo'shliqsiz: 151250, manfiy — minus bilan (teskari yozuv).
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(Math.round(value)) : '') : value;
  // Formula sifatida ochilib ketmasin (CSV injection): =, +, -, @ bilan boshlangan matn.
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function buildCsv<Row>(columns: readonly CsvColumn<Row>[], rows: readonly Row[]): string {
  const lines = [
    columns.map((column) => formatCell(column.header)).join(CSV_SEPARATOR),
    ...rows.map((row) => columns.map((column) => formatCell(column.value(row))).join(CSV_SEPARATOR)),
  ];
  return CSV_BOM + lines.join(LINE_BREAK) + LINE_BREAK;
}

/** «2027-01-14» → «14.01.2027» (Toshkent sanasi, vaqt zonasisiz). */
export function formatCsvDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return year && month && day ? `${day}.${month}.${year}` : isoDate;
}

/**
 * Fayl nomi: `statistika_08.01-14.01.2027.csv`. Yil bir xil bo'lsa boshlanishda
 * yil yozilmaydi; har xil bo'lsa ikkalasida ham (`28.12.2026-03.01.2027`).
 */
export function csvFileName(prefix: string, from: string, to: string): string {
  const start = formatCsvDate(from);
  const end = formatCsvDate(to);
  const sameYear = start.slice(6) === end.slice(6);
  const period = start === end ? end : `${sameYear ? start.slice(0, 5) : start}-${end}`;
  return `${prefix}_${period}.csv`;
}
