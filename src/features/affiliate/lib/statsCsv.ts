import type { TranslationKey } from '../../../shared/i18n/translations';
import { buildCsv, csvFileName, formatCsvDate, type CsvColumn } from '../../../shared/lib/csv';
import type { AffiliateStats, AffiliateStatsRow } from '../api/affiliateApi';

/**
 * Sotuvchi statistikasi CSV — kunlar bo'yicha (hujjat-statistika-csv, 1-fayl):
 * A Sana … J Mavjud, yangisi tepada, oxirida «Jami». Sonlar butun, bo'shliqsiz.
 */
type Translate = (key: TranslationKey) => string;

export function buildDailyStatsCsv(stats: AffiliateStats, from: string, to: string, t: Translate) {
  const totalKey = t('statsCsv.total');
  const columns: CsvColumn<AffiliateStatsRow>[] = [
    { header: t('statsCsv.date'), value: (row) => (row.key === 'TOTAL' ? totalKey : formatCsvDate(row.key)) },
    { header: t('statsCsv.clicks'), value: (row) => row.clicks },
    { header: t('statsCsv.leads'), value: (row) => row.leads },
    { header: t('statsCsv.valid'), value: (row) => row.validLeads },
    { header: t('statsCsv.confirmed'), value: (row) => row.confirmed },
    { header: t('statsCsv.delivered'), value: (row) => row.delivered },
    { header: t('statsCsv.refused'), value: (row) => row.refused },
    { header: t('statsCsv.income'), value: (row) => row.incomeHold + row.incomeAvailable },
    { header: t('statsCsv.hold'), value: (row) => row.incomeHold },
    { header: t('statsCsv.available'), value: (row) => row.incomeAvailable },
  ];
  const days = [...stats.rows].sort((a, b) => b.key.localeCompare(a.key));
  return {
    csv: buildCsv(columns, [...days, { ...stats.totals, key: 'TOTAL' }]),
    fileName: csvFileName(t('statsCsv.filePrefix'), from, to),
    rows: days.length + 1,
  };
}
