import { Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Banknote, ClipboardList, ReceiptText } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { ContentState } from '../../../shared/ui/ContentState/ContentState';
import { DailyBarChart } from '../../../shared/ui/DailyBarChart/DailyBarChart';
import { DataTable } from '../../../shared/ui/DataTable/DataTable';
import { DateRangeFilter } from '../../../shared/ui/DateRangeFilter/DateRangeFilter';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../../shared/ui/FilterPanel/FilterPanel';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { ResetFiltersButton } from '../../../shared/ui/ResetFiltersButton/ResetFiltersButton';
import { SummaryCard } from '../../../shared/ui/SummaryCard/SummaryCard';
import { TablePanel } from '../../../shared/ui/TablePanel/TablePanel';
import { useAdminSalesQuery, useAdminTopSalesQuery, type AdminTopSales } from '../api/adminAnalyticsQueries';
import { percentChange, type SalesRange } from '../lib/salesAnalytics';
import styles from './AdminSalesAnalytics.module.css';

const DATE = 'YYYY-MM-DD';
const DEFAULT_DAYS = 30;
const validDate = (value: string | null) => (value && dayjs(value, DATE, true).isValid() ? value : null);
const defaultRange = (): SalesRange => ({ dateFrom: dayjs().subtract(DEFAULT_DAYS - 1, 'day').format(DATE), dateTo: dayjs().format(DATE) });

/** Davr URL'da (`from`, `to`): yangilansa yoki havola ulashilsa ham o'sha davr ochiladi. Davr doim to'liq — oldingi davr bilan solishtiriladi. */
function resolveRange(params: URLSearchParams): SalesRange {
  const fallback = defaultRange();
  const range = { dateFrom: validDate(params.get('from')) ?? fallback.dateFrom, dateTo: validDate(params.get('to')) ?? fallback.dateTo };
  return range.dateFrom > range.dateTo ? fallback : range;
}

/** Grafik o'qi uchun qisqa summa ("1,7 mln"). Brauzer Intl'ida o'zbekcha qisqartma yo'q — birliklar shu yerda. */
const COMPACT_UNITS = {
  uz: [[1e9, ' mlrd'], [1e6, ' mln'], [1e3, ' ming']],
  ru: [[1e9, ' млрд'], [1e6, ' млн'], [1e3, ' тыс.']],
  en: [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']],
} as const;
function compactAmount(value: number, language: keyof typeof COMPACT_UNITS, locale: string) {
  const unit = COMPACT_UNITS[language].find(([size]) => value >= size);
  return unit ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / unit[0])}${unit[1]}` : String(value);
}

type ShopRow = AdminTopSales['shops'][number];
type ProductRow = AdminTopSales['products'][number];

/**
 * Admin uchun platforma savdosi tanlangan davr bo'yicha: aylanma, buyurtmalar, o'rtacha chek (oldingi
 * shunday davrga nisbatan), kunlik grafik va yetakchi do'kon/mahsulotlar. Hammasi haqiqiy buyurtmalardan.
 */
export function AdminSalesAnalytics() {
  const { language, locale, t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = resolveRange(searchParams);
  const fallback = defaultRange();
  const isDefault = range.dateFrom === fallback.dateFrom && range.dateTo === fallback.dateTo;
  const days = dayjs(range.dateTo).diff(dayjs(range.dateFrom), 'day') + 1;
  const salesQuery = useAdminSalesQuery(range);
  const sales = salesQuery.data;
  const hasSales = Boolean(sales?.totals.orders);
  const topQuery = useAdminTopSalesQuery(hasSales ? sales?.orderIds : undefined);
  const money = (value: number) => `${formatMoney(value)} ${t('product.currency')}`;

  const changeRange = ([from, to]: [string, string]) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set('from', from || fallback.dateFrom);
    next.set('to', to || fallback.dateTo);
    return next;
  }, { replace: true });
  const resetRange = () => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.delete('from');
    next.delete('to');
    return next;
  }, { replace: true });

  const change = (current: number, previous: number) => {
    const percent = percentChange(current, previous);
    if (percent === null) return t('adminAnalytics.noPrevious', { days });
    if (percent === 0) return t('adminAnalytics.changeFlat', { days });
    return t(percent > 0 ? 'adminAnalytics.changeUp' : 'adminAnalytics.changeDown', { percent: Math.abs(percent), days });
  };
  const cards = sales ? [
    { title: t('adminAnalytics.gmv'), value: money(sales.totals.gmv), caption: change(sales.totals.gmv, sales.previous.gmv), icon: <Banknote />, tone: 'success' as const },
    { title: t('adminAnalytics.orders'), value: sales.totals.orders, caption: change(sales.totals.orders, sales.previous.orders), icon: <ClipboardList />, tone: 'info' as const },
    { title: t('adminAnalytics.averageCheck'), value: money(sales.totals.averageCheck), caption: change(sales.totals.averageCheck, sales.previous.averageCheck), icon: <ReceiptText />, tone: 'warning' as const },
  ] : [];
  const bestDay = sales?.days.reduce((best, day) => (day.gmv > best.gmv ? day : best), sales.days[0]);

  const shopColumns: ColumnsType<ShopRow> = [
    { title: '#', width: 48, render: (_, __, index) => index + 1 },
    { title: t('adminAnalytics.shop'), dataIndex: 'name', render: (name: string) => <strong>{name}</strong> },
    { title: t('adminAnalytics.amount'), align: 'right', render: (_, shop) => <span className={styles.amount}>{money(shop.gmv)}</span> },
    { title: t('adminAnalytics.orders'), align: 'right', responsive: ['sm'], render: (_, shop) => shop.orders },
  ];
  const productColumns: ColumnsType<ProductRow> = [
    { title: '#', width: 48, render: (_, __, index) => index + 1 },
    { title: t('adminAnalytics.product'), dataIndex: 'name', render: (name: string) => <strong>{name}</strong> },
    { title: t('adminAnalytics.sold'), align: 'right', render: (_, product) => <span className={styles.amount}>{t('adminAnalytics.pieces', { count: product.quantity })}</span> },
    { title: t('adminAnalytics.amount'), align: 'right', responsive: ['sm'], render: (_, product) => <span className={styles.amount}>{money(product.gmv)}</span> },
  ];
  const tops = topQuery.data;
  // Ikkala reyting bitta so'rovdan — xato bo'lsa bir marta ko'rsatiladi.
  const topLoading = !tops ? <ContentState state="loading" /> : null;

  return (
    <section className={styles.section} aria-labelledby="admin-sales-analytics">
      <header className={styles.header}>
        <h2 id="admin-sales-analytics">{t('adminAnalytics.title')}</h2>
        <p>{t('adminAnalytics.description')}</p>
      </header>
      <FilterPanel className={styles.filterPanel} aria-label={t('adminAnalytics.filters')}>
        <DateRangeFilter className={styles.dateRange} value={[range.dateFrom, range.dateTo]} startLabel={t('adminAnalytics.dateFrom')} endLabel={t('adminAnalytics.dateTo')} onChange={changeRange} />
        <div className={styles.filterAction}><ResetFiltersButton disabled={isDefault} onClick={resetRange} /></div>
      </FilterPanel>
      <Alert className={styles.notice} type="info" showIcon title={t('adminAnalytics.rule')} />
      {salesQuery.isError && !sales ? <ContentState state="error" title={t('adminAnalytics.loadError')} description={getApiErrorMessage(salesQuery.error)} onAction={() => void salesQuery.refetch()} />
        : !sales ? <ContentState state="loading" />
        : <>
          {sales.truncated ? <Alert className={styles.notice} type="warning" showIcon title={t('adminAnalytics.truncated')} /> : null}
          <div className={styles.metricGrid} role="group" aria-label={t('adminAnalytics.summary')} aria-busy={salesQuery.isFetching}>
            {cards.map((card) => <SummaryCard key={card.title} {...card} />)}
          </div>
          {!hasSales ? <div className={styles.empty}><EmptyState title={t('adminAnalytics.empty')} description={t('adminAnalytics.emptyDescription')} /></div> : <>
            <TablePanel className={styles.panel} title={t('adminAnalytics.chart')} caption={t('adminAnalytics.chartCaption', { days, amount: money(bestDay?.gmv ?? 0) })}>
              <div className={styles.chart}>
                <DailyBarChart
                  points={sales.days.map((day) => ({ date: day.date, value: day.gmv, hint: t('adminAnalytics.ordersHint', { count: day.orders }) }))}
                  label={t('adminAnalytics.chart')}
                  formatValue={money}
                  formatAxis={(value) => compactAmount(value, language, locale)}
                  locale={locale}
                />
              </div>
            </TablePanel>
            {tops?.partial ? <Alert className={styles.notice} type="warning" showIcon title={t('adminAnalytics.partial')} /> : null}
            {topQuery.isError && !tops ? <div className={styles.panel}><ContentState state="error" title={t('adminAnalytics.topError')} description={getApiErrorMessage(topQuery.error)} onAction={() => void topQuery.refetch()} /></div> : <div className={styles.topGrid}>
              <TablePanel title={t('adminAnalytics.topShops')} caption={t('adminAnalytics.topShopsCaption')}>
                {topLoading ?? <DataTable<ShopRow> rowKey="shopId" columns={shopColumns} dataSource={tops?.shops ?? []} pagination={false} loading={topQuery.isFetching} tableLayout="auto" />}
              </TablePanel>
              <TablePanel title={t('adminAnalytics.topProducts')} caption={t('adminAnalytics.topProductsCaption')}>
                {topLoading ?? <DataTable<ProductRow> rowKey="productId" columns={productColumns} dataSource={tops?.products ?? []} pagination={false} loading={topQuery.isFetching} tableLayout="auto" />}
              </TablePanel>
            </div>}
          </>}
        </>}
    </section>
  );
}
