import { Table } from 'antd';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { AffiliateStats, AffiliateStream } from '../../../features/affiliate/api/affiliateApi';
import { emptyStatsRow, statsIncome } from '../../../features/affiliate/lib/statsSummary';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import styles from '../AffiliateHomePage.module.css';

interface PagesTodayProps {
  streams: UseQueryResult<{ items: AffiliateStream[]; total: number }>;
  /** Bugun, `groupBy=STREAM` — «Bugun» bloki bilan bir xil so'rov (bitta kesh). */
  stats: UseQueryResult<AffiliateStats>;
  asOf: string | null;
}

/** Havoladan domen: «[landing-domeni]/ k7m2qa» ko'rinishi uchun. */
const linkHost = (link: string) => {
  try {
    return new URL(link).host;
  } catch {
    return '';
  }
};

/**
 * «Sahifalaringiz — bugun» (sotuvchi-bosh): har sahifaning bugungi raqamlari va jami. Jami —
 * statistika API sining shu kungi `totals` i, «Bugun» bloki bilan bir xil (FE-04 TC3).
 */
export function PagesToday({ streams, stats, asOf }: PagesTodayProps) {
  const { t } = useTranslation();
  const money = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const byCode = new Map((stats.data?.rows ?? []).map((row) => [row.key, row]));
  const rows = (streams.data?.items ?? []).map((stream) => ({ stream, stats: byCode.get(stream.code) ?? emptyStatsRow(stream.code) }));
  const failed = (streams.isError && !streams.data) || (stats.isError && !stats.data);

  return (
    <section className={styles.card} aria-labelledby="affiliate-pages">
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 id="affiliate-pages">{t('sellerHome.pagesTitle')}</h2>
          {asOf ? <span className={styles.muted}>{t('sellerHome.pagesHint', { time: asOf })}</span> : null}
        </div>
        <div className={styles.headLinks}>
          <Link to="/affiliate/pages">{t('sellerHome.myPages')}</Link>
          <Link to="/affiliate/stats">{t('sellerHome.statistics')}</Link>
        </div>
      </header>
      {failed ? (
        <LoadError
          error={streams.error ?? stats.error}
          onRetry={() => {
            void streams.refetch();
            void stats.refetch();
          }}
        />
      ) : (
        <Table
          aria-label={t('sellerHome.pagesTable')}
          size="middle"
          rowKey={(row) => row.stream.id}
          loading={streams.isPending || stats.isPending}
          pagination={false}
          scroll={{ x: 760 }}
          dataSource={rows}
          locale={{ emptyText: t('sellerHome.pagesEmpty') }}
          columns={[
            {
              title: t('sellerHome.page'),
              key: 'page',
              render: (_: unknown, { stream }) => (
                <a href={stream.link} target="_blank" rel="noreferrer" className={styles.pageLink}>
                  <span className={styles.muted}>{linkHost(stream.link)}/</span>
                  <strong>{stream.code}</strong>
                </a>
              ),
            },
            { title: t('sellerHome.product'), key: 'product', render: (_: unknown, { stream }) => stream.productName },
            { title: t('sellerHome.price'), key: 'price', align: 'right', render: (_: unknown, { stream }) => money(stream.salePrice) },
            { title: t('statsCsv.clicks'), key: 'clicks', align: 'right', render: (_: unknown, row) => row.stats.clicks },
            { title: t('statsCsv.leads'), key: 'leads', align: 'right', render: (_: unknown, row) => row.stats.leads },
            { title: t('statsCsv.confirmed'), key: 'confirmed', align: 'right', render: (_: unknown, row) => row.stats.confirmed },
            { title: t('statsCsv.delivered'), key: 'delivered', align: 'right', render: (_: unknown, row) => row.stats.delivered },
            { title: t('statsCsv.income'), key: 'income', align: 'right', render: (_: unknown, row) => money(statsIncome(row.stats)) },
          ]}
          summary={() => stats.data && rows.length ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}><strong>{t('sellerHome.totalToday')}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><strong>{stats.data.totals.clicks}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><strong>{stats.data.totals.leads}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right"><strong>{stats.data.totals.confirmed}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right"><strong>{stats.data.totals.delivered}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right"><strong>{money(statsIncome(stats.data.totals))}</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null}
        />
      )}
    </section>
  );
}
