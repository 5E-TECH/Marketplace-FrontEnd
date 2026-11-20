import { Skeleton } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAffiliateStatsForStreams, useAffiliateStatsQuery, useAffiliateStreamsQuery } from '../../features/affiliate/api/affiliateApi';
import { mergeStats } from '../../features/affiliate/lib/mergeStats';
import { statsDays, statsIncome } from '../../features/affiliate/lib/statsSummary';
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
import { StatsToolbar, type StatsProduct } from './components/StatsToolbar';
import { formatRange, parsePeriod, periodDays, periodRange } from '../../features/affiliate/lib/statsPeriod';
import { parseCut } from './model/statsView';
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
  // Har ochilishda oyna yangidan: davr va tanlov sahifadagidek boshlanadi.
  const [exportSession, setExportSession] = useState(0);

  const period = parsePeriod(params.get('period'));
  const cut = parseCut(params.get('cut'));
  const { from, to } = periodRange(period, today);
  const range = formatRange(from, to);

  const streamsQuery = useAffiliateStreamsQuery();
  const streams = streamsQuery.data?.items ?? [];
  // Mahsulot filtri: sotuvchi sahifalaridagi mahsulotlar (BE-28 da parametr yo'q — sahifalar yig'indisi).
  const products: StatsProduct[] = [...new Map(streams.map((stream) => [stream.productId, { id: stream.productId, name: stream.productName }])).values()];
  const requestedProduct = params.get('product') || undefined;
  const productId = requestedProduct && (!streamsQuery.data || products.some((product) => product.id === requestedProduct)) ? requestedProduct : undefined;
  const productStreams = productId ? streams.filter((stream) => stream.productId === productId) : streams;
  const requested = params.get('page') || undefined;
  // Ro'yxatda yo'q (o'chirilgan, eski havola) yoki tanlangan mahsulotga tegishli bo'lmagan sahifa — filtrsiz.
  const streamId = requested && (!streamsQuery.data || productStreams.some((stream) => stream.id === requested)) ? requested : undefined;
  const selectedStream = streams.find((stream) => stream.id === streamId);
  const selectedProduct = products.find((product) => product.id === productId);
  const streamIds = streamId ? [streamId] : productId ? productStreams.map((stream) => stream.id) : [];

  const main = useAffiliateStatsForStreams(from, to, cut, streamIds, mergeStats);
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
        streams={productStreams}
        onStream={(value) => update({ page: value })}
        productId={productId}
        products={products}
        onProduct={(value) => update({ product: value, page: undefined })}
        onExport={() => {
          setExportSession((value) => value + 1);
          setExportOpen(true);
        }}
      />
      {main.isError && !main.data ? (
        <section className={styles.card}>
          <LoadError error={main.error} onRetry={() => void main.refetch()} lastSuccessAt={main.dataUpdatedAt} />
        </section>
      ) : (
        <StatsFunnel totals={totals} />
      )}
      <PageQualityCard
        streams={streamIds.length ? streams.filter((stream) => streamIds.includes(stream.id)) : streams}
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
        key={exportSession}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        today={today}
        period={period}
        streamIds={streamIds}
        streamLabel={selectedStream ? `${selectedStream.code} · ${selectedStream.productName}` : t('sellerStats.filter.all')}
        productLabel={selectedProduct?.name ?? t('sellerStats.filter.all')}
        dailyStats={cut === 'DAY' ? main.data : undefined}
        leadsTotal={totals?.leads}
      />
    </div>
  );
}
