import { useState } from 'react';
import { useAffiliateStatsQuery, useAffiliateStreamsQuery } from '../../features/affiliate/api/affiliateApi';
import { useSellerProfileQuery } from '../../features/sellerProfile/api/sellerProfileApi';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { addDays, tashkentClock, tashkentDate } from '../../shared/lib/tashkentTime';
import { usePageStatus } from '../../shared/ui/PageHeader/pageTitle';
import { BalanceCard } from '../../features/affiliate/ui/BalanceCard';
import { HomeBanners } from './components/HomeBanners';
import { NewsToday } from './components/NewsToday';
import { OnboardingSteps } from './components/OnboardingSteps';
import { PagesToday } from './components/PagesToday';
import { RevenueByDay } from './components/RevenueByDay';
import { TodaySummary } from './components/TodaySummary';
import styles from './AffiliateHomePage.module.css';

/**
 * Sotuvchi «Bosh sahifa» (sotuvchi-bosh): bannerlar, «Birinchi qadamlar» (yangi sotuvchi),
 * bugungi ko'rsatkichlar, kunlar bo'yicha daromad, bugungi xabarlar va sahifalar kesimi.
 * Bloklar alohida yuklanadi: statistika ochilmasa ham xabarlar ko'rinadi.
 * Raqamlar «Statistika» (FE-06) bilan bir xil so'rov va hisobdan (`statsSummary`) — FE-04 TC3.
 * «Mavjud» kartasi — balans (BE-23 taklifi); pul yechish ekrani — FE-07.
 */
export default function AffiliateHomePage() {
  const { t } = useTranslation();
  const [today] = useState(() => tashkentDate());
  const weekStart = addDays(today, -6);
  const week = useAffiliateStatsQuery(weekStart, today);
  const todayByStream = useAffiliateStatsQuery(today, today, 'STREAM');
  const streams = useAffiliateStreamsQuery();
  const profile = useSellerProfileQuery();
  const asOf = week.dataUpdatedAt ? tashkentClock(week.dataUpdatedAt) : null;
  const onboarding = Boolean(streams.data && streams.data.total === 0);
  usePageStatus(t('sellerHome.statusLabel'), asOf);

  return (
    <div className={styles.page}>
      <HomeBanners profile={profile.data} onboarding={onboarding} />
      {onboarding ? <OnboardingSteps hasPages={false} profile={profile.data} /> : null}
      <div className={styles.row}>
        <TodaySummary today={today} week={week} byStream={todayByStream.data} asOf={asOf} />
        <BalanceCard profile={profile.data} />
      </div>
      <div className={styles.row}>
        <RevenueByDay stats={week.data} loading={week.isPending} failed={week.isError} error={week.error} onRetry={() => void week.refetch()} from={weekStart} to={today} />
        <NewsToday today={today} asOf={asOf} />
      </div>
      <PagesToday streams={streams} stats={todayByStream} asOf={asOf} />
    </div>
  );
}
