import { App, Button, Checkbox } from 'antd';
import { Download, FileText, Lock } from 'lucide-react';
import { useState } from 'react';
import {
  fetchAllAffiliateLeads,
  getAffiliateStats,
  type AffiliateStats,
} from '../../../features/affiliate/api/affiliateApi';
import { buildLeadsCsv, DEFAULT_LEAD_CSV_COLUMNS, LEAD_CSV_COLUMNS, type LeadCsvColumn } from '../../../features/affiliate/lib/leadsCsv';
import { buildDailyStatsCsv } from '../../../features/affiliate/lib/statsCsv';
import { statsDays } from '../../../features/affiliate/lib/statsSummary';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { saveCsv } from '../../../shared/api/download';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { csvFileName } from '../../../shared/lib/csv';
import { SheetModal } from '../../../shared/ui/SheetModal/SheetModal';
import { periodDays } from '../model/statsView';
import styles from '../AffiliateStatsPage.module.css';

type ExportKind = 'daily' | 'leads';

interface StatsExportDialogProps {
  open: boolean;
  onClose: () => void;
  from: string;
  to: string;
  periodLabel: string;
  streamId: string | undefined;
  /** Sahifa filtri matni: «Barchasi» yoki «k7m2qa · Simsiz quloqchinlar». */
  streamLabel: string;
  /** Kun kesimi ochiq bo'lsa — sahifadagi o'sha javob (qayta so'ralmaydi). */
  dailyStats: AffiliateStats | undefined;
  /** Davrdagi lidlar soni (BE-28 `totals.leads`) — oynadagi «60 ta lid». */
  leadsTotal: number | undefined;
}

const MASK = '****4567';

/**
 * «Eksport — Statistika» (umumiy-eksport §1, hujjat-statistika-csv): «Kunlar bo'yicha» (kunlar va jami
 * qatori) yoki «Lidlar» (tanlangan ustunlar, mijoz faqat ****4567). Sahifadagi davr va sahifa filtri
 * qo'llanadi. Format — CSV (sotuvchi uchun PDF maketda [taklif], bu kartada yo'q).
 */
export function StatsExportDialog({
  open, onClose, from, to, periodLabel, streamId, streamLabel, dailyStats, leadsTotal,
}: StatsExportDialogProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [kind, setKind] = useState<ExportKind>('daily');
  const [columns, setColumns] = useState<LeadCsvColumn[]>([...DEFAULT_LEAD_CSV_COLUMNS]);
  const [busy, setBusy] = useState(false);
  const days = periodDays(from, to);
  const fileName = csvFileName(kind === 'daily' ? t('statsCsv.filePrefix') : t('sellerStats.csv.leadsFilePrefix'), from, to);
  const rows = kind === 'daily' ? days.length + 1 : leadsTotal;
  const noColumns = kind === 'leads' && columns.length === 0;

  const run = async () => {
    setBusy(true);
    try {
      if (kind === 'daily') {
        const stats = dailyStats ?? (await getAffiliateStats(from, to, undefined, 'DAY', streamId));
        // Server faoliyatsiz kunni bermasligi mumkin — faylda davrning har kuni bo'ladi (maketdagi «7 kun va jami»).
        const result = buildDailyStatsCsv({ rows: statsDays(stats, days), totals: stats.totals }, from, to, t);
        saveCsv(result.csv, result.fileName);
        void message.success(t('export.done', { name: result.fileName, rows: result.rows }));
      } else {
        const leads = await fetchAllAffiliateLeads({ from, to, streamId });
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

  return (
    <SheetModal
      open={open}
      onCancel={onClose}
      width={520}
      title={
        <span>
          {t('sellerStats.exportDialog.title')}
          <span className={styles.cellSub}>{periodLabel}</span>
        </span>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>{t('common.cancel')}</Button>,
        <Button key="submit" type="primary" icon={<Download size={18} aria-hidden />} loading={busy} disabled={noColumns} onClick={() => void run()}>
          {t('sellerStats.exportDialog.submit')}
        </Button>,
      ]}
      destroyOnHidden
    >
      <div className={styles.dialogBody}>
        <div>
          <span className={styles.fieldLabel}>{t('sellerStats.exportDialog.period')}</span>
          <span>{periodLabel}</span>
        </div>
        <fieldset className={styles.fieldset}>
          <legend className={styles.fieldLabel}>{t('sellerStats.exportDialog.what')}</legend>
          <div className={styles.choices}>
            {(['daily', 'leads'] as const).map((value) => (
              <label key={value} className={styles.choice} data-checked={kind === value}>
                <input type="radio" name="stats-export-kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                <span>
                  {t(value === 'daily' ? 'sellerStats.exportDialog.daily' : 'sellerStats.exportDialog.leads')}
                  <small>
                    {value === 'daily'
                      ? t('sellerStats.exportDialog.dailyHint', { count: days.length })
                      : t('sellerStats.exportDialog.leadsHint', { count: leadsTotal ?? '…' })}
                  </small>
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
        <p className={styles.muted}>{t('sellerStats.exportDialog.filters', { page: streamLabel })}</p>
        <p className={styles.privacy}>
          <Lock size={16} aria-hidden />
          <span>{t('sellerStats.exportDialog.privacy', { mask: MASK })}</span>
        </p>
        <p className={styles.fileLine} data-testid="stats-export-file">
          <FileText size={16} aria-hidden />
          <span>{t('sellerStats.exportDialog.file', { name: fileName, rows: rows ?? '…' })}</span>
        </p>
      </div>
    </SheetModal>
  );
}
