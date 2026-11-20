import { Table } from 'antd';
import { ChartColumn, Table2 } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import type { AffiliateStats, AffiliateStatsRow } from '../../../features/affiliate/api/affiliateApi';
import { statsDays, statsIncome } from '../../../features/affiliate/lib/statsSummary';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatCsvDate } from '../../../shared/lib/csv';
import { addDays } from '../../../shared/lib/tashkentTime';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import styles from '../AffiliateHomePage.module.css';
import { IncomeChart } from './IncomeChart';

interface RevenueByDayProps {
  stats: AffiliateStats | undefined;
  loading: boolean;
  failed: boolean;
  error: unknown;
  onRetry: () => void;
  from: string;
  to: string;
}

type View = 'chart' | 'table';

const VIEW_KEY = 'elchi_home_revenue_view';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'chart';
  } catch {
    return 'chart';
  }
}

/** «Daromad kunlar bo‘yicha» (sotuvchi-bosh): oxirgi 7 kun — grafik yoki jadval. CSV — «Statistika» sahifasida (FE-06). */
export function RevenueByDay({ stats, loading, failed, error, onRetry, from, to }: RevenueByDayProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>(readView);
  const money = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const dayKeys = Array.from({ length: 7 }, (_, index) => addDays(from, index));
  const days = statsDays(stats, dayKeys);
  const hasIncome = days.some((day) => statsIncome(day) > 0);
  const availableDays = days.filter((day) => day.incomeAvailable > 0).map((day) => day.key);
  const holdDays = days.filter((day) => day.incomeHold > 0).map((day) => day.key);
  const legend = [
    { key: 'available', label: t('sellerHome.available'), sum: days.reduce((total, day) => total + day.incomeAvailable, 0), range: dayRange(availableDays) },
    { key: 'hold', label: t('sellerHome.hold'), sum: days.reduce((total, day) => total + day.incomeHold, 0), range: dayRange(holdDays) },
  ];

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Saqlanmasa ham ko'rinish shu sahifada almashadi.
    }
  };

  return (
    <section className={`${styles.card} ${styles.revenue}`} aria-labelledby="affiliate-week">
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 id="affiliate-week">{t('sellerHome.revenueTitle')}</h2>
          <span className={styles.muted}>
            {t('sellerHome.revenueHint', { range: `${formatCsvDate(from).slice(0, 5)}–${formatCsvDate(to)}` })}
          </span>
        </div>
        <div className={styles.headActions}>
          <ViewToggle value={view} onChange={changeView} />
        </div>
      </header>

      {failed && !stats ? (
        <LoadError error={error} onRetry={onRetry} />
      ) : stats ? (
        <div className={styles.totalRow}>
          <div className={styles.total}>
            <strong>{money(statsIncome(stats.totals))}</strong>
            <span className={styles.muted}>{t('sellerHome.deliveredOrders', { count: stats.totals.delivered })}</span>
          </div>
          {hasIncome ? (
            <ul className={styles.legend}>
              {legend.map((item) => (
                <li key={item.key}>
                  <span className={styles.swatch} data-series={item.key} aria-hidden />
                  <span>
                    <strong>{item.label}</strong>{' '}
                    <span className={styles.muted}>{money(item.sum)}{item.range ? ` · ${item.range}` : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {failed && !stats ? null : view === 'chart' ? (
        stats && !hasIncome ? (
          <div className={styles.empty}>
            <strong>{t('sellerHome.noStatsTitle')}</strong>
            <span className={styles.muted}>{t('sellerHome.noStatsText')}</span>
          </div>
        ) : (
          <IncomeChart days={days} today={to} />
        )
      ) : (
        <Table<AffiliateStatsRow>
          size="middle"
          rowKey="key"
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={[...days].reverse()}
          columns={[
            { title: t('statsCsv.date'), dataIndex: 'key', render: (key: string) => formatCsvDate(key) },
            { title: t('statsCsv.clicks'), dataIndex: 'clicks', align: 'right' },
            { title: t('statsCsv.leads'), dataIndex: 'leads', align: 'right' },
            { title: t('statsCsv.confirmed'), dataIndex: 'confirmed', align: 'right' },
            { title: t('statsCsv.delivered'), dataIndex: 'delivered', align: 'right' },
            { title: t('statsCsv.income'), key: 'income', align: 'right', render: (_: unknown, row) => money(statsIncome(row)) },
          ]}
          summary={() => stats ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><strong>{t('statsCsv.total')}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><strong>{stats.totals.clicks}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><strong>{stats.totals.leads}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><strong>{stats.totals.confirmed}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><strong>{stats.totals.delivered}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right"><strong>{money(statsIncome(stats.totals))}</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null}
        />
      )}
    </section>
  );
}

/** «09–12.01» — kunlar oralig'i; bitta kun bo'lsa «09.01». */
function dayRange(keys: string[]): string {
  if (!keys.length) return '';
  const first = keys[0];
  const last = keys[keys.length - 1];
  const dm = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}`;
  if (first === last) return dm(first);
  return first.slice(5, 7) === last.slice(5, 7) ? `${first.slice(8, 10)}–${dm(last)}` : `${dm(first)}–${dm(last)}`;
}

const VIEWS: ReadonlyArray<{ value: View; icon: typeof ChartColumn }> = [
  { value: 'chart', icon: ChartColumn },
  { value: 'table', icon: Table2 },
];

/** «Ko‘rinish»: grafik yoki jadval — ikonkali radio guruh (strelkalar bilan almashadi). */
function ViewToggle({ value, onChange }: { value: View; onChange: (view: View) => void }) {
  const { t } = useTranslation();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + VIEWS.length) % VIEWS.length;
    onChange(VIEWS[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={t('sellerHome.view')} className={styles.viewToggle}>
      {VIEWS.map(({ value: option, icon: Icon }, index) => (
        <button
          key={option}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === option}
          aria-label={option === 'chart' ? t('sellerHome.chart') : t('sellerHome.table')}
          title={option === 'chart' ? t('sellerHome.chart') : t('sellerHome.table')}
          tabIndex={value === option ? 0 : -1}
          onClick={() => onChange(option)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <Icon size={18} aria-hidden />
        </button>
      ))}
    </div>
  );
}
