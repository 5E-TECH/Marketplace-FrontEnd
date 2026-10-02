import { Alert, Grid } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { CircleCheckBig, CircleX, Truck } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSellerOrdersQuery } from '../../features/orders/api/orderQueries';
import type { SellerOrder, SellerOrderStatus } from '../../features/orders/model/orderTypes';
import { useSellerFinanceSummaryQuery } from '../../features/sellerFinance/api/sellerFinanceQueries';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { TABLE_PAGE_SIZE } from '../../shared/config/pagination';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatDateTime } from '../../shared/lib/date';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { DateRangeFilter } from '../../shared/ui/DateRangeFilter/DateRangeFilter';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { ResetFiltersButton } from '../../shared/ui/ResetFiltersButton/ResetFiltersButton';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { SummaryCard } from '../../shared/ui/SummaryCard/SummaryCard';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './FinancePage.module.css';

const DATE = 'YYYY-MM-DD';
const isDate = (value: string | null): value is string => Boolean(value && dayjs(value, DATE, true).isValid());
/** Standart davr — joriy oy boshidan bugungacha: kartalar butun davr bo'yicha sanaladi, shuning uchun cheklangan. */
const defaultRange = (): [string, string] => [dayjs().startOf('month').format(DATE), dayjs().format(DATE)];

/**
 * Sotuvchi moliyasi — mavjud buyurtma ma'lumotidan: yetkazilgan / yo'ldagi / bekor qilingan
 * buyurtmalar summasi va har buyurtma bo'yicha hisob. Komissiya, to'lanadigan summa va
 * o'tkazmalar backend sotuvchi moliya endpointlari chiqqach qo'shiladi (taxmin qilinmaydi).
 */
export default function FinancePage() {
  const { locale, t } = useTranslation();
  // Telefonda holat buyurtma raqami ostiga tushadi — summa ustuni to'liq ko'rinib turadi.
  const compact = !Grid.useBreakpoint().sm;
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialFrom, initialTo] = defaultRange();
  const from = searchParams.has('from') ? (isDate(searchParams.get('from')) ? searchParams.get('from')! : '') : initialFrom;
  const to = searchParams.has('to') ? (isDate(searchParams.get('to')) ? searchParams.get('to')! : '') : initialTo;
  const [page, setPage] = useState(1);
  const range = { ...(from ? { dateFrom: from } : {}), ...(to ? { dateTo: to } : {}) };
  const summaryQuery = useSellerFinanceSummaryQuery(range);
  const ordersQuery = useSellerOrdersQuery({ page, limit: TABLE_PAGE_SIZE, ...range });
  const money = (value: number) => `${formatMoney(value)} ${t('product.currency')}`;
  const isDefault = from === initialFrom && to === initialTo;

  // Davr URL'da saqlanadi: sahifa yangilansa yoki havola ulashilsa ham o'sha davr ochiladi.
  const changeRange = ([nextFrom, nextTo]: [string, string]) => {
    setPage(1);
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set('from', nextFrom); next.set('to', nextTo); return next; }, { replace: true });
  };
  const resetRange = () => {
    setPage(1);
    setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('from'); next.delete('to'); return next; }, { replace: true });
  };

  const summary = summaryQuery.data;
  const cards = summary ? [
    { title: t('sellerFinance.delivered'), value: money(summary.delivered.amount), caption: t('sellerFinance.ordersCount', { count: summary.delivered.count }), icon: <CircleCheckBig />, tone: 'success' as const },
    { title: t('sellerFinance.inProgress'), value: money(summary.inProgress.amount), caption: t('sellerFinance.ordersCount', { count: summary.inProgress.count }), icon: <Truck />, tone: 'info' as const },
    { title: t('sellerFinance.closed'), value: money(summary.closed.amount), caption: t('sellerFinance.ordersCount', { count: summary.closed.count }), icon: <CircleX />, tone: 'warning' as const },
  ] : [];

  const columns: ColumnsType<SellerOrder> = [
    { title: t('sellerFinance.order'), render: (_, order) => <span className={styles.idCell}><strong>#{order.salesOrderId}</strong>{compact ? <StatusTag status={order.status} /> : <small>{t('order.internalId', { id: order.id })}</small>}</span> },
    { title: t('sellerFinance.date'), dataIndex: 'createdAt', responsive: ['md'], render: (value: string) => formatDateTime(value, locale) },
    { title: t('sellerFinance.status'), dataIndex: 'status', responsive: ['sm'], render: (value: SellerOrderStatus) => <StatusTag status={value} /> },
    // Summalar tiplangan maydondan o'qiladi: model o'zgarsa kompilyator ushlaydi.
    { title: t('sellerFinance.goods'), align: 'right', render: (_, order) => <strong className={styles.amount}>{money(order.subtotal)}</strong> },
    { title: t('sellerFinance.delivery'), align: 'right', responsive: ['lg'], render: (_, order) => money(order.deliveryFee) },
    { title: t('sellerFinance.cod'), align: 'right', responsive: ['sm'], render: (_, order) => money(order.codAmount) },
  ];

  return <main className={styles.page}>
    <PageHeader title={t('sellerFinance.title')} description={t('sellerFinance.description')} />
    <FilterPanel className={styles.filterPanel} aria-label={t('sellerFinance.filters')}>
      <DateRangeFilter className={styles.dateRange} value={[from, to]} startLabel={t('sellerFinance.dateFrom')} endLabel={t('sellerFinance.dateTo')} onChange={changeRange} />
      <div className={styles.filterAction}><ResetFiltersButton disabled={isDefault} onClick={resetRange} /></div>
    </FilterPanel>
    <Alert className={styles.notice} type="info" showIcon title={t('sellerFinance.notice')} />
    {summaryQuery.isError && !summary ? <ContentState state="error" title={t('sellerFinance.summaryError')} description={getApiErrorMessage(summaryQuery.error)} onAction={() => void summaryQuery.refetch()} />
      : !summary ? <ContentState state="loading" />
      : <section className={styles.metricGrid} aria-label={t('sellerFinance.summary')} aria-busy={summaryQuery.isFetching}>
        {cards.map((card) => <SummaryCard key={card.title} {...card} />)}
      </section>}
    {summary?.truncated ? <Alert className={styles.notice} type="warning" showIcon title={t('sellerFinance.truncated')} /> : null}
    {ordersQuery.isError ? <ContentState state="error" title={t('sellerFinance.loadError')} description={getApiErrorMessage(ordersQuery.error)} onAction={() => void ordersQuery.refetch()} />
      : !ordersQuery.data ? <ContentState state="loading" />
      : <TablePanel className={styles.tablePanel} title={t('sellerFinance.orders')} caption={t('pagination.total', { total: ordersQuery.data.total })}>
        <DataTable<SellerOrder> loading={ordersQuery.isFetching} rowKey="id" columns={columns} dataSource={ordersQuery.data.items} tableLayout="auto" emptyState={<EmptyState compact title={t('sellerFinance.empty')} description={t('sellerFinance.emptyDescription')} />} pagination={{ current: page, total: ordersQuery.data.total, onChange: setPage }} />
      </TablePanel>}
  </main>;
}
