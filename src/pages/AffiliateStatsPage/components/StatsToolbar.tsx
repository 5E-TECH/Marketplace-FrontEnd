import { Button, Segmented, Select } from 'antd';
import { Download, Lock } from 'lucide-react';
import type { AffiliateStream } from '../../../features/affiliate/api/affiliateApi';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatRange, PERIOD_PRESETS, periodRange, STATS_CUTS, type PeriodPreset, type StatsCut } from '../model/statsView';
import styles from '../AffiliateStatsPage.module.css';

interface StatsToolbarProps {
  today: string;
  period: PeriodPreset;
  onPeriod: (period: PeriodPreset) => void;
  cut: StatsCut;
  onCut: (cut: StatsCut) => void;
  streamId: string | undefined;
  streams: readonly AffiliateStream[];
  streamsLoading: boolean;
  onStream: (streamId: string | undefined) => void;
  onExport: () => void;
}

/**
 * Asboblar qatori (sotuvchi-statistika): davr, «Kesim: Kun · Sahifa · Sub», sahifa filtri (× bilan
 * tozalanadi), mijoz raqami izohi va «Eksport». «Mahsulot» filtri yo'q: BE-28 da mahsulot bo'yicha
 * parametr yo'q (faqat `streamId`).
 */
export function StatsToolbar({
  today, period, onPeriod, cut, onCut, streamId, streams, streamsLoading, onStream, onExport,
}: StatsToolbarProps) {
  const { t } = useTranslation();
  const periodOptions = PERIOD_PRESETS.map((preset) => {
    const range = periodRange(preset, today);
    return {
      value: preset,
      label: t('sellerStats.period.value', { name: t(`sellerStats.period.${preset}` as TranslationKey), range: formatRange(range.from, range.to) }),
    };
  });

  return (
    <div className={styles.toolbar}>
      <label className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel}>{t('sellerStats.period.label')}</span>
        <Select
          className={styles.period}
          value={period}
          options={periodOptions}
          onChange={onPeriod}
          aria-label={t('sellerStats.period.label')}
          popupMatchSelectWidth={false}
        />
      </label>
      <div className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel} id="stats-cut-label">{t('sellerStats.cut.label')}</span>
        <Segmented<StatsCut>
          aria-labelledby="stats-cut-label"
          value={cut}
          onChange={onCut}
          options={STATS_CUTS.map((value) => ({ value, label: t(`sellerStats.cut.${value}` as TranslationKey) }))}
        />
      </div>
      <label className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel}>{t('sellerStats.filter.page')}</span>
        <Select
          className={styles.pageFilter}
          value={streamId}
          placeholder={t('sellerStats.filter.all')}
          allowClear={{ clearIcon: <span aria-label={t('sellerStats.filter.clear')}>×</span> }}
          loading={streamsLoading}
          onChange={(value?: string) => onStream(value || undefined)}
          aria-label={t('sellerStats.filter.page')}
          popupMatchSelectWidth={false}
          options={streams.map((stream) => ({ value: stream.id, label: `${stream.code} · ${stream.productName}` }))}
        />
      </label>
      <span className={styles.maskNote}>
        <Lock size={14} aria-hidden />
        {t('sellerStats.maskNote', { mask: '****4567' }).split('****4567').flatMap((part, index) => (index ? [<strong key={index}>****4567</strong>, part] : [part]))}
      </span>
      <Button icon={<Download size={18} aria-hidden />} onClick={onExport}>
        {t('sellerStats.export')}
      </Button>
    </div>
  );
}
