import { Skeleton } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAffiliateStatsQuery, useAffiliateStreamsQuery } from '../../features/affiliate/api/affiliateApi';
import { statsDays, statsIncome } from '../../features/affiliate/lib/statsSummary';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDate } from '../../shared/lib/tashkentTime';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { usePageStatus } from '../../shared/ui/PageHeader/pageTitle';
import { LeadsFooter } from './components/LeadsFooter';
import { PageQualityCard } from './components/PageQualityCard';
import { StatsByDay } from './components/StatsByDay';
import { StatsExportDialog } from './components/StatsExportDialog';
import { StatsFunnel } from './components/StatsFunnel';
import { StatsGroupTable } from './components/StatsGroupTable';
import { StatsToolbar } from './components/StatsToolbar';
import { formatRange, parseCut, parsePeriod, periodDays, periodRange } from './model/statsView';
import styles from './AffiliateStatsPage.module.css';

/**
 * Sotuvchi «Statistika» (FE-06, SOT-4; sotuvchi-statistika): davr, kesim (kun · sahifa · sub) va
 * sahifa filtri; natija va daromad (ushlab turilgan / mavjud), sahifa sifati, kesim jadvali, CSV.
 * Hamma son BE-28 (`/affiliate/stats`) dan; mijoz raqami faqat CSV da va faqat ****4567.
 * Bloklar alohida yuklanadi: biri ochilmasa, qolgani ko'rinadi.
 */
export default function AffiliateStatsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [today] = useState(() => tashkentDate());
  const [exportOpen, setExportOpen] = useState(false);

  const period = parsePeriod(params.get('period'));
  const cut = parseCut(params.get('cut'));
  const { from, to } = periodRange(period, today);
  const range = formatRange(from, to);

  const streamsQuery = useAffiliateStreamsQuery();
  const streams = streamsQuery.data?.items ?? [];
  const requested = params.get('page') || undefined;
  // Ro'yxatda yo'q sahifa (o'chirilgan, eski havola) — filtrsiz.
  const streamId = requested && (!streamsQuery.data || streams.some((stream) => stream.id === requested)) ? requested : undefined;
  const selectedStream = streams.find((stream) => stream.id === streamId);

  const main = useAffiliateStatsQuery(from, to, cut, streamId);
  const quality = useAffiliateStatsQuery(from, to, 'STREAM');
  const asOf = main.dataUpdatedAt ? tashkentClock(main.dataUpdatedAt) : null;
  usePageStatus(t('sellerHome.statusLabel'), asOf);

  const update = (patch: Record<string, string | undefined>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

  const totals = main.data?.totals;
  const empty = Boolean(totals && totals.clicks === 0 && totals.leads === 0 && statsIncome(totals) === 0);
  const periodLabel = t('sellerStats.period.value', { name: t(`sellerStats.period.${period}` as TranslationKey), range });

  let breakdown;
  if (main.isError && !main.data) {
    breakdown = null;
  } else if (!main.data) {
    breakdown = (
      <section className={styles.card} aria-busy="true">
        <Skeleton active paragraph={{ rows: 6 }} />
      </section>
    );
  } else if (empty) {
    breakdown = (
      <section className={styles.card}>
        <EmptyState title={t('sellerStats.empty.title')} description={t('sellerStats.empty.description')} compact />
      </section>
    );
  } else if (cut === 'DAY') {
    breakdown = <StatsByDay days={statsDays(main.data, periodDays(from, to))} totals={main.data.totals} today={today} asOf={asOf} range={range} />;
  } else {
    breakdown = <StatsGroupTable cut={cut} rows={main.data.rows} totals={main.data.totals} streams={streams} range={range} />;
  }

  return (
    <div className={styles.page}>
      <StatsToolbar
        today={today}
        period={period}
        onPeriod={(value) => update({ period: value })}
        cut={cut}
        onCut={(value) => update({ cut: value === 'DAY' ? undefined : value })}
        streamId={streamId}
        streams={streams}
        streamsLoading={streamsQuery.isPending}
        onStream={(value) => update({ page: value })}
        onExport={() => setExportOpen(true)}
      />
      {main.isError && !main.data ? (
        <section className={styles.card}>
          <LoadError error={main.error} onRetry={() => void main.refetch()} lastSuccessAt={main.dataUpdatedAt} />
        </section>
      ) : (
        <StatsFunnel totals={totals} />
      )}
      <PageQualityCard
        streams={streamId ? streams.filter((stream) => stream.id === streamId) : streams}
        rows={quality.data?.rows}
        loading={quality.isPending || streamsQuery.isPending}
        error={quality.error ?? streamsQuery.error}
        onRetry={() => {
          void quality.refetch();
          void streamsQuery.refetch();
        }}
        range={range}
      />
      {breakdown}
      <LeadsFooter today={today} asOf={asOf} />
      <StatsExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        from={from}
        to={to}
        periodLabel={periodLabel}
        streamId={streamId}
        streamLabel={selectedStream ? `${selectedStream.code} · ${selectedStream.productName}` : t('sellerStats.filter.all')}
        dailyStats={cut === 'DAY' ? main.data : undefined}
        leadsTotal={totals?.leads}
      />
    </div>
  );
}
