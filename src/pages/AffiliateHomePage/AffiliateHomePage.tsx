import { Table } from 'antd';
import { useState } from 'react';
import { useAffiliateStatsQuery, type AffiliateStatsRow } from '../../features/affiliate/api/affiliateApi';
import { buildDailyStatsCsv } from '../../features/affiliate/lib/statsCsv';
import { saveCsv } from '../../shared/api/download';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatCsvDate } from '../../shared/lib/csv';
import { addDays, tashkentClock, tashkentDate } from '../../shared/lib/tashkentTime';
import { ExportButton } from '../../shared/ui/ExportButton/ExportButton';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import styles from './AffiliateHomePage.module.css';

const income = (row: AffiliateStatsRow) => row.incomeHold + row.incomeAvailable;

/**
 * Sotuvchi «Bosh sahifa» (sotuvchi-bosh, FE-02 TC1): bugungi ko'rsatkichlar va oxirgi
 * 7 kun, CSV eksport (TC3). To'liq sahifa — balans, grafik, xabarlar — FE-04.
 */
export default function AffiliateHomePage() {
  const { t } = useTranslation();
  const [today] = useState(() => tashkentDate());
  const weekStart = addDays(today, -6);
  const week = useAffiliateStatsQuery(weekStart, today);
  const money = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const todayRow = week.data?.rows.find((row) => row.key === today);
  const days = [...(week.data?.rows ?? [])].sort((a, b) => b.key.localeCompare(a.key));

  if (week.isError && !week.data) {
    return <LoadError error={week.error} onRetry={() => void week.refetch()} lastSuccessAt={week.dataUpdatedAt} />;
  }

  const kpis = [
    { label: t('statsCsv.clicks'), hint: t('affiliateHome.clicksHint'), value: todayRow?.clicks },
    { label: t('statsCsv.leads'), hint: t('affiliateHome.leadsHint'), value: todayRow?.leads },
    { label: t('statsCsv.confirmed'), hint: t('affiliateHome.confirmedHint'), value: todayRow?.confirmed },
    { label: t('statsCsv.delivered'), hint: t('affiliateHome.deliveredHint'), value: todayRow?.delivered },
    { label: t('statsCsv.income'), hint: t('affiliateHome.incomeHint'), value: todayRow ? money(income(todayRow)) : undefined },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="affiliate-today">
        <header className={styles.head}>
          <h2 id="affiliate-today">{t('affiliateHome.todayTitle')}</h2>
          {week.dataUpdatedAt ? (
            <span className={styles.muted}>{t('affiliateHome.asOf', { date: formatCsvDate(today), time: tashkentClock(week.dataUpdatedAt) })}</span>
          ) : null}
        </header>
        <ol className={styles.kpis} aria-label={t('affiliateHome.todayTitle')}>
          {kpis.map((kpi) => (
            <li key={kpi.label}>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              <strong className={styles.kpiValue}>{week.isPending ? '…' : kpi.value ?? 0}</strong>
              <span className={styles.muted}>{kpi.hint}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.card} aria-labelledby="affiliate-week">
        <header className={styles.head}>
          <div>
            <h2 id="affiliate-week">{t('affiliateHome.weekTitle')}</h2>
            <span className={styles.muted}>{formatCsvDate(weekStart).slice(0, 5)}–{formatCsvDate(today)} · {t('affiliateHome.weekHint')}</span>
          </div>
          <ExportButton
            disabled={!week.data}
            onExport={() => {
              if (!week.data) throw new Error('Statistika hali yuklanmadi');
              const { csv, fileName, rows } = buildDailyStatsCsv(week.data, weekStart, today, t);
              saveCsv(csv, fileName);
              return { fileName, rows };
            }}
          />
        </header>
        <Table<AffiliateStatsRow>
          size="middle"
          rowKey="key"
          loading={week.isPending}
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={days}
          columns={[
            { title: t('statsCsv.date'), dataIndex: 'key', render: (key: string) => formatCsvDate(key) },
            { title: t('statsCsv.clicks'), dataIndex: 'clicks', align: 'right' },
            { title: t('statsCsv.leads'), dataIndex: 'leads', align: 'right' },
            { title: t('statsCsv.confirmed'), dataIndex: 'confirmed', align: 'right' },
            { title: t('statsCsv.delivered'), dataIndex: 'delivered', align: 'right' },
            { title: t('statsCsv.income'), key: 'income', align: 'right', render: (_: unknown, row) => money(income(row)) },
          ]}
          summary={() => week.data ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><strong>{t('statsCsv.total')}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><strong>{week.data.totals.clicks}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><strong>{week.data.totals.leads}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><strong>{week.data.totals.confirmed}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><strong>{week.data.totals.delivered}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right"><strong>{money(income(week.data.totals))}</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null}
        />
      </section>
    </div>
  );
}
