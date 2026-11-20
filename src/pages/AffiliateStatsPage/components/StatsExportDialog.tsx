import { App, Checkbox } from 'antd';
import { ChevronDown, Download, FileSpreadsheet, LoaderCircle, Lock, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useAppSelector } from '../../../app/store/hooks';
import {
  fetchAllAffiliateLeads,
  getAffiliateStats,
  type AffiliateLead,
  type AffiliateStats,
} from '../../../features/affiliate/api/affiliateApi';
import { selectAuthUser } from '../../../features/auth/model/authSlice';
import { buildLeadsCsv, DEFAULT_LEAD_CSV_COLUMNS, LEAD_CSV_COLUMNS, type LeadCsvColumn } from '../../../features/affiliate/lib/leadsCsv';
import { mergeStats } from '../../../features/affiliate/lib/mergeStats';
import { buildDailyStatsCsv } from '../../../features/affiliate/lib/statsCsv';
import { statsDays } from '../../../features/affiliate/lib/statsSummary';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { saveCsv } from '../../../shared/api/download';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { csvFileName } from '../../../shared/lib/csv';
import { shortPersonName } from '../../../shared/lib/personName';
import { SheetModal } from '../../../shared/ui/SheetModal/SheetModal';
import { formatRange, PERIOD_PRESETS, periodDays, periodRange, type PeriodPreset } from '../../../features/affiliate/lib/statsPeriod';
import styles from '../AffiliateStatsPage.module.css';

type ExportKind = 'daily' | 'leads';

interface StatsExportDialogProps {
  open: boolean;
  onClose: () => void;
  today: string;
  /** Sahifadagi davr — oynada sukut bo'yicha shu, o'zgartirsa faqat faylga ta'sir qiladi. */
  period: PeriodPreset;
  /** Sahifa yoki mahsulot filtri: tanlangan sahifalar (bo'sh — hammasi). */
  streamIds: readonly string[];
  /** Sahifa filtri matni: «Barchasi» yoki «k7m2qa · Simsiz quloqchinlar». */
  streamLabel: string;
  productLabel: string;
  /** Kun kesimi ochiq bo'lsa — sahifadagi o'sha javob (shu davr uchun qayta so'ralmaydi). */
  dailyStats: AffiliateStats | undefined;
  /** Sahifadagi davrdagi lidlar soni (BE-28 `totals.leads`) — oynadagi «60 ta lid». */
  leadsTotal: number | undefined;
}

const MASK = '****4567';

/** Bir nechta sahifa lidlari — birlashtirilib, eng yangisi tepada. */
async function fetchLeads(from: string, to: string, streamIds: readonly string[]) {
  const ids = streamIds.length ? streamIds : [undefined];
  const parts = await Promise.all(ids.map((streamId) => fetchAllAffiliateLeads({ from, to, streamId })));
  const items: AffiliateLead[] = parts.flatMap((part) => part.items).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, truncated: parts.some((part) => part.truncated) };
}

/**
 * «Eksport — Statistika» (umumiy-eksport): davr, «Kunlar bo'yicha» (kunlar va jami qatori) yoki «Lidlar»
 * (tanlangan ustunlar, mijoz faqat ****4567). Sahifa va mahsulot filtri qo'llanadi. Format — CSV
 * (PDF bu kartada yo'q: FE-06 — «CSV eksport»).
 */
export function StatsExportDialog({
  open, onClose, today, period, streamIds, streamLabel, productLabel, dailyStats, leadsTotal,
}: StatsExportDialogProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const user = useAppSelector(selectAuthUser);
  const periodId = useId();
  const [exportPeriod, setExportPeriod] = useState<PeriodPreset>(period);
  const [kind, setKind] = useState<ExportKind>('daily');
  const [columns, setColumns] = useState<LeadCsvColumn[]>([...DEFAULT_LEAD_CSV_COLUMNS]);
  const [busy, setBusy] = useState(false);
  const { from, to } = periodRange(exportPeriod, today);
  const samePeriod = exportPeriod === period;
  const periodLabel = (preset: PeriodPreset) => {
    const range = periodRange(preset, today);
    return t('sellerStats.period.value', { name: t(`sellerStats.period.${preset}` as TranslationKey), range: formatRange(range.from, range.to) });
  };
  const days = periodDays(from, to);
  const leadsCount = samePeriod ? leadsTotal : undefined;
  const fileName = csvFileName(kind === 'daily' ? t('statsCsv.filePrefix') : t('sellerStats.csv.leadsFilePrefix'), from, to);
  const rows = kind === 'daily' ? days.length + 1 : leadsCount;
  const noColumns = kind === 'leads' && columns.length === 0;
  const name = user?.name.trim() ? shortPersonName(user.name) : null;

  const run = async () => {
    setBusy(true);
    try {
      if (kind === 'daily') {
        const stats = samePeriod && dailyStats
          ? dailyStats
          : streamIds.length > 1
            ? mergeStats(await Promise.all(streamIds.map((streamId) => getAffiliateStats(from, to, undefined, 'DAY', streamId))))
            : await getAffiliateStats(from, to, undefined, 'DAY', streamIds[0]);
        // Server faoliyatsiz kunni bermasligi mumkin — faylda davrning har kuni bo'ladi (maketdagi «7 kun va jami»).
        const result = buildDailyStatsCsv({ rows: statsDays(stats, days), totals: stats.totals }, from, to, t);
        saveCsv(result.csv, result.fileName);
        void message.success(t('export.done', { name: result.fileName, rows: result.rows }));
      } else {
        const leads = await fetchLeads(from, to, streamIds);
        const result = buildLeadsCsv(leads.items, columns, { from, to }, t);
        saveCsv(result.csv, result.fileName);
        void message.success(t('export.done', { name: result.fileName, rows: result.rows }));
        if (leads.truncated) void message.warning(t('sellerStats.exportDialog.truncated', { count: leads.items.length }));
      }
      onClose();
    } catch (error) {
      void message.error(error instanceof Error && !('isAxiosError' in error) ? t('export.failed') : getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (column: LeadCsvColumn, checked: boolean) =>
    setColumns((current) => (checked ? LEAD_CSV_COLUMNS.filter((item) => item === column || current.includes(item)) : current.filter((item) => item !== column)));
  const privacy = t('sellerStats.exportDialog.privacy', { mask: MASK }).split(MASK);

  return (
    <SheetModal
      open={open}
      onCancel={onClose}
      width={520}
      title={t('sellerStats.exportDialog.title')}
      closable={false}
      footer={null}
      rootClassName={styles.exportDialog}
      destroyOnHidden
    >
      <div className={styles.dialog}>
        <div className={styles.dialogHead}>
          <span className={styles.dialogIcon} aria-hidden><Download /></span>
          <div className={styles.dialogTitle}>
            <h3>{t('sellerStats.exportDialog.title')}</h3>
            <p>{name ? `${name} · ` : ''}{periodLabel(exportPeriod)}</p>
          </div>
          <button type="button" className={styles.dialogClose} aria-label={t('sellerStats.exportDialog.close')} title={t('sellerStats.exportDialog.close')} onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>

        <div className={styles.dialogBody}>
          <div>
            <label htmlFor={periodId} className={styles.fieldLabel}>{t('sellerStats.exportDialog.period')}</label>
            <span className={styles.fieldSelect}>
              <select id={periodId} value={exportPeriod} onChange={(event) => setExportPeriod(event.target.value as PeriodPreset)}>
                {PERIOD_PRESETS.map((preset) => <option key={preset} value={preset}>{periodLabel(preset)}</option>)}
              </select>
              <ChevronDown aria-hidden />
            </span>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.fieldLabel}>{t('sellerStats.exportDialog.what')}</legend>
            <div className={styles.choices}>
              {(['daily', 'leads'] as const).map((value) => (
                <label key={value} className={styles.choice} data-checked={kind === value}>
                  <input type="radio" name="stats-export-kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                  <span className={styles.choiceText}>
                    <span>{t(value === 'daily' ? 'sellerStats.exportDialog.daily' : 'sellerStats.exportDialog.leads')}</span>
                    <span>
                      {value === 'daily'
                        ? t('sellerStats.exportDialog.dailyHint', { count: days.length })
                        : t('sellerStats.exportDialog.leadsHint', { count: leadsCount ?? '…' })}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {kind === 'leads' ? (
            <fieldset className={styles.fieldset}>
              <legend className={styles.fieldLabel}>{t('sellerStats.exportDialog.columns')}</legend>
              <div className={styles.columns}>
                {LEAD_CSV_COLUMNS.map((column) => (
                  <Checkbox key={column} checked={columns.includes(column)} onChange={(event) => toggle(column, event.target.checked)}>
                    {t(`sellerStats.exportDialog.col.${column}` as TranslationKey)}
                    {column === 'customer' ? (
                      <span className={styles.maskTag}>
                        <Lock size={12} aria-hidden />
                        {MASK}
                      </span>
                    ) : null}
                  </Checkbox>
                ))}
              </div>
              {noColumns ? <p className={styles.muted} role="alert">{t('sellerStats.exportDialog.noColumns')}</p> : null}
            </fieldset>
          ) : null}

          <p className={styles.filtersNote}>
            {t('sellerStats.exportDialog.filtersLead')}{' '}
            <span>{t('sellerStats.filter.page')} — <strong>{streamLabel}</strong></span>
            {' · '}
            <span>{t('sellerStats.filter.product')} — <strong>{productLabel}</strong></span>
          </p>
          <div className={styles.privacy}>
            <Lock aria-hidden />
            <p>{privacy[0]}<strong>{MASK}</strong>{privacy[1]}</p>
          </div>
          <p className={styles.fileLine} data-testid="stats-export-file">
            <FileSpreadsheet aria-hidden />
            <span>
              {t('sellerStats.exportDialog.fileLabel')} <strong>{fileName}</strong> · {t('sellerStats.exportDialog.rows', { rows: rows ?? '…' })}
            </span>
          </p>
        </div>

        <div className={styles.dialogFooter}>
          <button type="button" className={styles.dialogButton} onClick={onClose}>{t('sellerStats.exportDialog.cancel')}</button>
          <button
            type="button"
            className={`${styles.dialogButton} ${styles.dialogPrimary}`}
            disabled={noColumns || busy}
            aria-busy={busy || undefined}
            onClick={() => void run()}
          >
            {busy ? <LoaderCircle className={styles.spin} aria-hidden /> : <Download aria-hidden />}
            {t('sellerStats.exportDialog.submit')}
          </button>
        </div>
      </div>
    </SheetModal>
  );
}
