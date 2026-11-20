import { Dropdown } from 'antd';
import { ChevronDown, Download, FileSpreadsheet, Lock } from 'lucide-react';
import { useId } from 'react';
import type { AffiliateStream } from '../../../features/affiliate/api/affiliateApi';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { PillSelect } from '../../../shared/ui/PillSelect/PillSelect';
import type { PeriodPreset } from '../../../features/affiliate/lib/statsPeriod';
import { PeriodPill } from '../../../features/affiliate/ui/PeriodPill';
import { STATS_CUTS, type StatsCut } from '../model/statsView';
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

/**
 * Asboblar qatori (sotuvchi-statistika): desktopda «Davr» yuqori qatorda (`h1` yonida); «Kesim: Kun ·
 * Sahifa · Sub», «Sahifa» va «Mahsulot» pillari, mijoz raqami izohi va «Eksport ▾» (CSV).
 * Mahsulot — BE-28 da parametr yo'q: sahifa uning sahifalari bo'yicha yig'iladi (`mergeStats`).
 */
export function StatsToolbar({
  today, period, onPeriod, cut, onCut, streamId, streams, onStream, productId, products, onProduct, onExport,
}: StatsToolbarProps) {
  const { t } = useTranslation();
  const cutLabelId = useId();
  const all = t('sellerStats.filter.all');

  return (
    <div className={styles.toolbar} role="search" aria-label={t('sellerStats.filters')}>
      <PeriodPill today={today} period={period} onChange={onPeriod} />
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
