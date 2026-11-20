import type { UseQueryResult } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AffiliateLeadStatus, AffiliateStats } from '../../../features/affiliate/api/affiliateApi';
import { useAffiliateLeadsQuery } from '../../../features/affiliate/api/affiliateApi';
import { statsForDay, statsIncome } from '../../../features/affiliate/lib/statsSummary';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatCsvDate } from '../../../shared/lib/csv';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import styles from '../AffiliateHomePage.module.css';

interface TodaySummaryProps {
  today: string;
  week: UseQueryResult<AffiliateStats>;
  /** Bugun, sahifalar bo'yicha (`groupBy=STREAM`) — daromadning bo'linishi uchun. */
  byStream: AffiliateStats | undefined;
  asOf: string | null;
}

/** Holat chipi rangi (sotuvchi-bosh: «Qayta qo‘ng‘iroq» — sariq, «Dublikat» — kulrang). */
const LEAD_TONE: Record<AffiliateLeadStatus, 'warning' | 'neutral' | 'success' | 'danger' | 'info'> = {
  NEW: 'info',
  BOOKED: 'info',
  CALLBACK: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  INVALID: 'danger',
  MERGED: 'neutral',
  NO_CONTACT: 'neutral',
};

const weekdayKey = (isoDate: string) => `sellerHome.weekday${new Date(`${isoDate}T00:00:00Z`).getUTCDay()}` as TranslationKey;

/**
 * «Bugun» (sotuvchi-bosh): kliklar → lidlar → tasdiqlangan → yetkazilgan → daromad; daromad
 * sahifalar bo'yicha, bugungi lidlar holati bilan. Raqamlar statistika API sidan (FE-04 TC3).
 */
export function TodaySummary({ today, week, byStream, asOf }: TodaySummaryProps) {
  const { t } = useTranslation();
  const leads = useAffiliateLeadsQuery(today, today);
  const row = statsForDay(week.data, today);
  const number = (value: number) => formatMoney(value);
  const incomeParts = (byStream?.rows ?? []).filter((item) => statsIncome(item) > 0);

  const kpis = [
    { label: t('statsCsv.clicks'), hint: t('affiliateHome.clicksHint'), value: row?.clicks },
    { label: t('statsCsv.leads'), hint: t('affiliateHome.leadsHint'), value: row?.leads },
    { label: t('statsCsv.confirmed'), hint: t('affiliateHome.confirmedHint'), value: row?.confirmed },
    { label: t('statsCsv.delivered'), hint: t('affiliateHome.deliveredHint'), value: row?.delivered },
  ];

  // Holatlar faqat ro'yxat to'liq kelganda (100 tadan ko'p bo'lsa — faqat jami va havola).
  const leadItems = leads.data && leads.data.items.length === leads.data.total ? leads.data.items : null;
  const statusCounts = leadItems
    ? [...leadItems.reduce((map, lead) => map.set(lead.status, (map.get(lead.status) ?? 0) + 1), new Map<AffiliateLeadStatus, number>())]
        .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <section className={`${styles.card} ${styles.today}`} aria-labelledby="affiliate-today">
      <header className={styles.head}>
        <h2 id="affiliate-today">{t('affiliateHome.todayTitle')}</h2>
        <span className={styles.muted}>
          {asOf
            ? t('sellerHome.todayAsOf', { weekday: t(weekdayKey(today)), date: formatCsvDate(today), time: asOf })
            : t('sellerHome.loading')}
        </span>
      </header>

      {week.isError && !week.data ? (
        <LoadError error={week.error} onRetry={() => void week.refetch()} lastSuccessAt={week.dataUpdatedAt} />
      ) : (
        <>
          <ol className={styles.funnel} aria-label={t('sellerHome.todayKpis')}>
            {kpis.map((kpi) => (
              <li key={kpi.label}>
                <span className={styles.kpiLabel}>{kpi.label}</span>
                <strong className={styles.kpiValue} data-testid="today-kpi">
                  {week.isPending ? <span className={styles.skeleton} aria-label={t('sellerHome.loading')} /> : kpi.value ?? 0}
                </strong>
                <span className={styles.muted}>{kpi.hint}</span>
                <ChevronRight className={styles.funnelArrow} size={16} aria-hidden />
              </li>
            ))}
            <li className={styles.incomeKpi}>
              <span className={styles.kpiLabel}>{t('statsCsv.income')}</span>
              <strong className={styles.incomeValue} data-testid="today-kpi">
                {week.isPending || !row ? (
                  <span className={styles.skeleton} aria-label={t('sellerHome.loading')} />
                ) : (
                  <>
                    {number(statsIncome(row))}
                    <span className={styles.currency}> {t('affiliateHome.sum', { amount: '' }).trim()}</span>
                  </>
                )}
              </strong>
              <span className={styles.muted}>
                {incomeParts.length
                  ? incomeParts.map((part) => `${part.key} ${number(statsIncome(part))}`).join(' + ')
                  : t('affiliateHome.incomeHint')}
              </span>
            </li>
          </ol>

          {leads.data && leads.data.total > 0 ? (
            <div className={styles.leadsLine}>
              <span className={styles.leadsLabel}>{t('sellerHome.todayLeads', { count: leads.data.total })}</span>
              {statusCounts.map(([status, count]) => (
                <span key={status} className={styles.chip} data-tone={LEAD_TONE[status]}>
                  {t(`sellerHome.lead.${status}` as TranslationKey)}&nbsp;·&nbsp;{count}
                </span>
              ))}
              <Link to="/affiliate/leads" className={styles.leadsLink}>
                {t('sellerHome.leadsLink')}
                <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
          ) : null}
        </>
      )}
      <p className={styles.note}>{t('sellerHome.incomeNote')}</p>
    </section>
  );
}
