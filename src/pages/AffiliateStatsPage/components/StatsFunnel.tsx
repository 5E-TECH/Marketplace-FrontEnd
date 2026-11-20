import { ChevronRight } from 'lucide-react';
import { Skeleton } from 'antd';
import type { AffiliateStatsRow } from '../../../features/affiliate/api/affiliateApi';
import { statsIncome } from '../../../features/affiliate/lib/statsSummary';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { signedMoney } from '../../../features/affiliate/lib/statsPeriod';
import styles from '../AffiliateStatsPage.module.css';

const KPIS: { field: keyof Omit<AffiliateStatsRow, 'key' | 'incomeHold' | 'incomeAvailable'>; label: TranslationKey; hint: TranslationKey }[] = [
  { field: 'clicks', label: 'statsCsv.clicks', hint: 'sellerStats.kpi.clicksHint' },
  { field: 'leads', label: 'statsCsv.leads', hint: 'sellerStats.kpi.leadsHint' },
  { field: 'validLeads', label: 'statsCsv.valid', hint: 'sellerStats.kpi.validHint' },
  { field: 'confirmed', label: 'statsCsv.confirmed', hint: 'sellerStats.kpi.confirmedHint' },
  { field: 'delivered', label: 'statsCsv.delivered', hint: 'sellerStats.kpi.deliveredHint' },
  { field: 'refused', label: 'statsCsv.refused', hint: 'sellerStats.kpi.refusedHint' },
];

/**
 * Natija (sotuvchi-statistika, 1-blok): kliklar → lidlar → yaroqli → tasdiqlangan → yetkazilgan, rad
 * etilgan va daromad (mavjud + ushlab turilgan, MOL-2). Hammasi BE-28 `totals` dan — «Raqamlar API bilan bir xil».
 */
export function StatsFunnel({ totals }: { totals: AffiliateStatsRow | undefined }) {
  const { t } = useTranslation();
  if (!totals) {
    return (
      <section className={styles.card} aria-label={t('sellerStats.kpi.region')} aria-busy="true">
        <Skeleton active title={false} paragraph={{ rows: 3 }} />
      </section>
    );
  }
  const income = statsIncome(totals);
  const positive = Math.max(totals.incomeAvailable, 0) + Math.max(totals.incomeHold, 0);
  const share = (value: number) => (positive > 0 ? `${(Math.max(value, 0) / positive) * 100}%` : '0%');
  const pending = Math.max(0, totals.confirmed - totals.delivered - totals.refused);

  return (
    <section className={`${styles.card} ${styles.funnel}`} aria-label={t('sellerStats.kpi.region')} data-testid="stats-funnel">
      <ul className={styles.kpis}>
        {KPIS.map((kpi, index) => (
          <li key={kpi.field} data-kpi={kpi.field}>
            <span className={styles.kpiLabel}>{t(kpi.label)}</span>
            <span className={styles.kpiValue}>{formatMoney(totals[kpi.field])}</span>
            <span className={styles.kpiHint}>{t(kpi.hint)}</span>
            {/* Voronka: kliklar › lidlar › yaroqli › tasdiqlangan › yetkazilgan (rad etilgan — alohida). */}
            {index < 4 ? <ChevronRight className={styles.kpiArrow} aria-hidden /> : null}
          </li>
        ))}
      </ul>
      <div className={styles.income} data-kpi="income">
        <span className={styles.kpiLabel}>{t('sellerStats.kpi.income')}</span>
        <span className={`${styles.incomeValue}${income < 0 ? ` ${styles.negative}` : ''}`}>
          {signedMoney(income)}
          <small>{t('affiliateHome.sum', { amount: '' }).trim()}</small>
        </span>
        <div className={styles.split} aria-hidden>
          <span className={styles.splitAvailable} style={{ width: share(totals.incomeAvailable) }} />
          <span className={styles.splitHold} style={{ width: share(totals.incomeHold) }} />
        </div>
        <ul className={styles.legend}>
          <li data-income="available">
            <i className={`${styles.dot} ${styles.dotAvailable}`} aria-hidden />
            {t('sellerHome.available')} <b>{signedMoney(totals.incomeAvailable)}</b>
          </li>
          <li data-income="hold">
            <i className={`${styles.dot} ${styles.dotHold}`} aria-hidden />
            {t('sellerHome.hold')} <b>{signedMoney(totals.incomeHold)}</b>
          </li>
        </ul>
      </div>
      <p className={styles.funnelNote}>
        {t('sellerStats.funnelNote', { confirmed: totals.confirmed, delivered: totals.delivered, refused: totals.refused, pending })}
      </p>
    </section>
  );
}
