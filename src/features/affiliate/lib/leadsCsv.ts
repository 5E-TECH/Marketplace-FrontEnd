import type { TranslationKey } from '../../../shared/i18n/translations';
import { buildCsv, csvFileName, formatCsvDate, type CsvColumn } from '../../../shared/lib/csv';
import { tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import type { AffiliateLead } from '../api/affiliateApi';

/**
 * Lidlar CSV (hujjat-statistika-csv, 2-fayl; FE-06 TC2): A Keldi … I Haq holati, yangisi tepada.
 * Mijoz faqat `****4567` — ism, manzil, to'liq raqam va S1/S3 varianti faylga yozilmaydi (SOT-4).
 */
type Translate = (key: TranslationKey) => string;

/** Eksport oynasidagi ustunlar (umumiy-eksport). «Haq» — faylda ikki ustun: summa va holati. */
export const LEAD_CSV_COLUMNS = ['came', 'lead', 'page', 'sub1', 'sub25', 'customer', 'leadStatus', 'order', 'commission'] as const;
export type LeadCsvColumn = (typeof LEAD_CSV_COLUMNS)[number];
/** Sukut tanlovi — maketdagidek: sub2–sub5 dan boshqa hammasi. */
export const DEFAULT_LEAD_CSV_COLUMNS: readonly LeadCsvColumn[] = LEAD_CSV_COLUMNS.filter((column) => column !== 'sub25');

/**
 * Raqam faqat oxirgi 4 raqam bilan. Server allaqachon `****4567` beradi; boshqa shaklda kelsa
 * ham (masalan, to'liq raqam) faylga faqat oxirgi 4 raqam tushadi — to'liq raqam hech qayerda yo'q.
 */
export function maskPhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits ? `****${digits.slice(-4)}` : '';
}

/** «2027-01-14T08:20:00Z» → «14.01.2027 13:20» (Toshkent vaqti). */
export function formatCsvDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatCsvDate(tashkentDate(date))} ${tashkentClock(date)}`;
}

const orderLabel = (status: string | null, t: Translate) => {
  if (!status) return '';
  // Noma'lum holat (backend yangi qiymat qo'shsa) — asl qiymati, bo'sh katak emas.
  return t(`sellerStats.order.${status}` as TranslationKey) || status;
};

export function buildLeadsCsv(
  leads: readonly AffiliateLead[],
  selected: readonly LeadCsvColumn[],
  period: { from: string; to: string },
  t: Translate,
) {
  const has = (column: LeadCsvColumn) => selected.includes(column);
  const columns: CsvColumn<AffiliateLead>[] = [];
  if (has('came')) columns.push({ header: t('sellerStats.csv.came'), value: (lead) => formatCsvDateTime(lead.createdAt) });
  if (has('lead')) columns.push({ header: t('sellerStats.csv.lead'), value: (lead) => lead.id });
  if (has('page')) columns.push({ header: t('sellerStats.csv.page'), value: (lead) => lead.streamCode });
  if (has('sub1')) columns.push({ header: 'sub1', value: (lead) => lead.sub1 });
  if (has('sub25')) {
    columns.push(
      { header: 'sub2', value: (lead) => lead.sub2 },
      { header: 'sub3', value: (lead) => lead.sub3 },
      { header: 'sub4', value: (lead) => lead.sub4 },
      { header: 'sub5', value: (lead) => lead.sub5 },
    );
  }
  if (has('customer')) columns.push({ header: t('sellerStats.csv.customer'), value: (lead) => maskPhone(lead.phoneLast4) });
  if (has('leadStatus')) columns.push({ header: t('sellerStats.csv.leadStatus'), value: (lead) => t(`sellerHome.lead.${lead.status}` as TranslationKey) });
  if (has('order')) columns.push({ header: t('sellerStats.csv.order'), value: (lead) => orderLabel(lead.orderStatus, t) });
  if (has('commission')) {
    columns.push(
      { header: t('sellerStats.csv.commission'), value: (lead) => lead.commission },
      {
        header: t('sellerStats.csv.commissionState'),
        value: (lead) => (lead.commissionState ? t(`sellerStats.commission.${lead.commissionState}` as TranslationKey) : ''),
      },
    );
  }
  const rows = [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    csv: buildCsv(columns, rows),
    fileName: csvFileName(t('sellerStats.csv.leadsFilePrefix'), period.from, period.to),
    rows: rows.length,
  };
}
