import { Dropdown } from 'antd';
import { ChevronDown, Download, FileSpreadsheet, Lock } from 'lucide-react';
import { useId } from 'react';
import { createPortal } from 'react-dom';
import type { AffiliateStream } from '../../../features/affiliate/api/affiliateApi';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { usePageHeaderSlot } from '../../../shared/ui/PageHeader/pageTitle';
import { formatRange, PERIOD_PRESETS, periodRange, STATS_CUTS, type PeriodPreset, type StatsCut } from '../model/statsView';
import styles from '../AffiliateStatsPage.module.css';

export interface StatsProduct {
  id: string;
  name: string;
}

interface StatsToolbarProps {
  today: string;
  period: PeriodPreset;
  onPeriod: (period: PeriodPreset) => void;
  cut: StatsCut;
  onCut: (cut: StatsCut) => void;
  streamId: string | undefined;
  /** «Sahifa» variantlari — mahsulot tanlangan bo'lsa, faqat uning sahifalari. */
  streams: readonly AffiliateStream[];
  onStream: (streamId: string | undefined) => void;
  productId: string | undefined;
  products: readonly StatsProduct[];
  onProduct: (productId: string | undefined) => void;
  onExport: () => void;
}

const MASK = '****4567';

/** «Davr: …» kabi pill-tanlov (komponentlar-E §4): yorliq ichida, o'ngda chevron. */
function PillSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <span className={styles.pill}>
      <label htmlFor={id} className={styles.pillLabel}>{label}:</label>
      <select id={id} className={styles.pillSelect} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown className={styles.pillChevron} aria-hidden />
    </span>
  );
}

/**
 * Asboblar qatori (sotuvchi-statistika): desktopda «Davr» yuqori qatorda (`h1` yonida); «Kesim: Kun ·
 * Sahifa · Sub», «Sahifa» va «Mahsulot» pillari, mijoz raqami izohi va «Eksport ▾» (CSV).
 * Mahsulot — BE-28 da parametr yo'q: sahifa uning sahifalari bo'yicha yig'iladi (`mergeStats`).
 */
export function StatsToolbar({
  today, period, onPeriod, cut, onCut, streamId, streams, onStream, productId, products, onProduct, onExport,
}: StatsToolbarProps) {
  const { t } = useTranslation();
  const headerSlot = usePageHeaderSlot();
  const cutLabelId = useId();
  const all = t('sellerStats.filter.all');

  const periodPill = (
    <PillSelect
      label={t('sellerStats.period.label')}
      value={period}
      onChange={(value) => onPeriod(value as PeriodPreset)}
      options={PERIOD_PRESETS.map((preset) => {
        const range = periodRange(preset, today);
        return { value: preset, label: t('sellerStats.period.value', { name: t(`sellerStats.period.${preset}` as TranslationKey), range: formatRange(range.from, range.to) }) };
      })}
    />
  );

  return (
    <div className={styles.toolbar} role="search" aria-label={t('sellerStats.filters')}>
      {headerSlot ? createPortal(periodPill, headerSlot) : periodPill}
      <div className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel} id={cutLabelId}>{t('sellerStats.cut.label')}</span>
        <div className={styles.segment} role="radiogroup" aria-labelledby={cutLabelId}>
          {STATS_CUTS.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={cut === value} className={styles.segmentItem} onClick={() => onCut(value)}>
              {t(`sellerStats.cut.${value}` as TranslationKey)}
            </button>
          ))}
        </div>
      </div>
      <PillSelect
        label={t('sellerStats.filter.page')}
        value={streamId ?? ''}
        onChange={(value) => onStream(value || undefined)}
        options={[{ value: '', label: all }, ...streams.map((stream) => ({ value: stream.id, label: `${stream.code} · ${stream.productName}` }))]}
      />
      <PillSelect
        label={t('sellerStats.filter.product')}
        value={productId ?? ''}
        onChange={(value) => onProduct(value || undefined)}
        options={[{ value: '', label: all }, ...products.map((product) => ({ value: product.id, label: product.name }))]}
      />
      <div className={styles.toolbarEnd}>
        <span className={styles.maskNote}>
          <Lock size={16} aria-hidden />
          {t('sellerStats.maskNote', { mask: MASK }).split(MASK).flatMap((part, index) => (index ? [<strong key={index}>{MASK}</strong>, part] : [part]))}
        </span>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          rootClassName={styles.exportMenu}
          menu={{
            items: [
              {
                key: 'csv',
                icon: <FileSpreadsheet aria-hidden />,
                label: (
                  <span className={styles.exportItem}>
                    <span>{t('sellerStats.exportMenu.csv')}</span>
                    <span>{t('sellerStats.exportMenu.csvHint')}</span>
                  </span>
                ),
              },
            ],
            onClick: onExport,
          }}
        >
          <button type="button" className={styles.exportButton} aria-haspopup="menu">
            <Download aria-hidden />
            {t('sellerStats.export')}
            <ChevronDown aria-hidden />
          </button>
        </Dropdown>
      </div>
    </div>
  );
}
