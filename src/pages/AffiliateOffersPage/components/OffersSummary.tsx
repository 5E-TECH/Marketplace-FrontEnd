import type { UseQueryResult } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import type { AffiliateStats } from '../../../features/affiliate/api/affiliateApi';
import { signedMoney } from '../../../features/affiliate/lib/statsPeriod';
import { statsIncome } from '../../../features/affiliate/lib/statsSummary';
import { BalanceCard } from '../../../features/affiliate/ui/BalanceCard';
import type { SellerProfile } from '../../../features/sellerProfile/api/sellerProfileApi';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import styles from '../AffiliateOffersPage.module.css';

const KPIS = [
  { field: 'clicks', label: 'statsCsv.clicks', hint: 'affiliateHome.clicksHint' },
  { field: 'leads', label: 'statsCsv.leads', hint: 'affiliateHome.leadsHint' },
  { field: 'confirmed', label: 'statsCsv.confirmed', hint: 'affiliateHome.confirmedHint', wide: true },
  { field: 'delivered', label: 'statsCsv.delivered', hint: 'affiliateHome.deliveredHint', wide: true },
] as const satisfies readonly { field: keyof AffiliateStats['totals']; label: TranslationKey; hint: TranslationKey; wide?: boolean }[];

/**
 * 1-qator (sotuvchi-offerlar): davr bo'yicha natija — kliklar › lidlar › tasdiqlangan › yetkazilgan ›
 * daromad (bosh sahifa va «Statistika» bilan bir xil so'rov) va «Mavjud» kartasi.
 */
export function OffersSummary({ stats, profile }: { stats: UseQueryResult<AffiliateStats>; profile: SellerProfile | undefined }) {
  const { t } = useTranslation();
  const totals = stats.data?.totals;
  const value = (content: string) => (totals ? content : <span className={styles.skeleton} aria-label={t('sellerHome.loading')} />);

  return (
    <div className={styles.summaryRow}>
      <section className={styles.kpiCard} aria-label={t('offers.kpiRegion')} data-testid="offers-kpi">
        {stats.isError && !stats.data ? (
          <LoadError variant="row" error={stats.error} onRetry={() => void stats.refetch()} />
        ) : (
          <ol className={styles.kpis}>
            {KPIS.map((kpi) => (
              <Fragment key={kpi.field}>
                <li className={styles.kpi} data-wide={'wide' in kpi || undefined}>
                  <span className={styles.kpiLabel}>{t(kpi.label)}</span>
                  <span className={styles.kpiValue}>{value(formatMoney(totals?.[kpi.field] ?? 0))}</span>
                  <span className={styles.kpiHint}>{t(kpi.hint)}</span>
                </li>
                <li className={styles.kpiArrow} aria-hidden><ChevronRight /></li>
              </Fragment>
            ))}
            <li className={`${styles.kpi} ${styles.kpiIncome}`}>
              <span className={styles.kpiLabel}>{t('statsCsv.income')}</span>
              <span className={styles.kpiValue}>{value(t('affiliateHome.sum', { amount: signedMoney(totals ? statsIncome(totals) : 0) }))}</span>
              <span className={styles.kpiHint}>{t('offers.incomeHint')}</span>
            </li>
          </ol>
        )}
        <p className={styles.kpiNote}>{t('sellerHome.incomeNote')}</p>
      </section>
      <BalanceCard profile={profile} />
    </div>
  );
}
