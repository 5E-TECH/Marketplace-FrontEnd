import { Button, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CalendarDays, Eye, RotateCcw, Search } from 'lucide-react';
import { useState } from 'react';
import { useAdminOrderQuery, useAdminOrdersQuery } from '../../features/orders/api/orderQueries';
import type { AdminOrder, AdminOrderDetail, AdminOrderStatus, AdminPaymentMethod } from '../../features/orders/model/orderTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import styles from './AdminOrdersPage.module.css';
import { formatDateTime } from '../../shared/lib/date';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { DetailDrawer } from '../../shared/ui/DetailDrawer/DetailDrawer';
import { DetailList } from '../../shared/ui/DetailList/DetailList';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import type { TranslationKey } from '../../shared/i18n/translations';

type StatusFilter = 'ALL' | AdminOrderStatus;
type PaymentFilter = 'ALL' | AdminPaymentMethod;

const statuses: AdminOrderStatus[] = [
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'CANCELLED',
  'REFUNDED',
];
const statusLabelKeys: Record<AdminOrderStatus, TranslationKey> = {
  DRAFT: 'status.draft',
  PENDING_PAYMENT: 'status.pendingPayment',
  PAID: 'status.paid',
  CONFIRMED: 'status.confirmed',
  PARTIALLY_FULFILLED: 'status.partiallyFulfilled',
  FULFILLED: 'status.fulfilled',
  CANCELLED: 'status.cancelled',
  REFUNDED: 'status.refunded',
};

export default function AdminOrdersPage() {
  const { locale, t } = useTranslation();
  const [status, setStatus] = useState<StatusFilter>('ALL'); const [payment, setPayment] = useState<PaymentFilter>('ALL'); const [shopId, setShopId] = useState(''); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState(''); const [page, setPage] = useState(1); const [selected, setSelected] = useState<AdminOrder | null>(null);
  const deferredShopId = useDebouncedValue(shopId.trim());
  const query = useAdminOrdersQuery({ page, limit: 20, ...(status !== 'ALL' ? { status } : {}), ...(payment !== 'ALL' ? { paymentMethod: payment } : {}), ...(deferredShopId ? { shopId: deferredShopId } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) });
  const detail = useAdminOrderQuery(selected?.id ?? null); const reset = () => { setStatus('ALL'); setPayment('ALL'); setShopId(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const columns: ColumnsType<AdminOrder> = [
    { title: t('adminOrders.order'), render: (_, order) => `#${order.orderNumber}` },
    { title: t('adminOrders.buyer'), dataIndex: 'buyerName', responsive: ['md'], render: (value: string | null) => value || '—' },
    { title: t('adminOrders.shopId'), dataIndex: 'shopId', responsive: ['lg'], render: (value: string | null, order) => order.shopName || (value ? `#${value}` : order.sellersCount ? t('adminOrders.shopCount', { count: order.sellersCount }) : '—') },
    { title: t('adminOrders.amount'), dataIndex: 'totalAmount', responsive: ['sm'], render: (value: number) => <span className={styles.amount}>{formatMoney(value)} UZS</span> },
    { title: t('adminOrders.payment'), dataIndex: 'paymentMethod', width: 100, render: (value: AdminPaymentMethod | null) => value ? value.toUpperCase() : '—' },
    { title: t('users.status'), dataIndex: 'status', width: 170, render: (value: AdminOrderStatus) => <StatusTag status={value} /> },
    { title: t('users.createdAt'), dataIndex: 'createdAt', responsive: ['xl'], render: (value: string) => value ? formatDateTime(value, locale) : '—' },
    { title: t('users.actions'), width: 80, align: 'center', render: (_, order) => <span className={styles.rowActions}><Button type="text" icon={<Eye size={17}/>} aria-label={t('adminOrders.detail')} onClick={() => setSelected(order)} /></span> },
  ];
  const hasFilters = status !== 'ALL' || payment !== 'ALL' || Boolean(shopId || dateFrom || dateTo);
  return <main className={styles.page}><PageHeader title={t('adminOrders.title')} description={t('adminOrders.description')} />
    <FilterPanel className={styles.filterPanel} aria-label={t('adminOrders.filters')}>
      <div className={`${styles.field} ${styles.marketField}`}><label htmlFor="admin-order-market">{t('adminOrders.shopId')}</label><Input id="admin-order-market" prefix={<Search aria-hidden />} value={shopId} inputMode="numeric" placeholder={t('adminOrders.shopIdPlaceholder')} allowClear onChange={(event) => { setShopId(event.target.value.replace(/\D/g, '')); setPage(1); }} /></div>
      <div className={styles.field}><label htmlFor="admin-order-status">{t('users.status')}</label><Select<StatusFilter> id="admin-order-status" value={status} options={[{value:'ALL',label:t('users.allStatuses')}, ...statuses.map((value) => ({value,label:t(statusLabelKeys[value])}))]} onChange={(value) => { setStatus(value); setPage(1); }} /></div>
      <div className={styles.field}><label htmlFor="admin-order-payment">{t('adminOrders.payment')}</label><Select<PaymentFilter> id="admin-order-payment" value={payment} options={[{ value: 'ALL', label: t('adminOrders.allPayments') }, { value: 'online', label: 'Online' }, { value: 'cod', label: 'COD' }]} onChange={(value) => { setPayment(value); setPage(1); }} /></div>
      <div className={styles.field}><label htmlFor="admin-order-from">{t('adminOrders.dateFrom')}</label><Input id="admin-order-from" prefix={<CalendarDays aria-hidden />} type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></div>
      <div className={styles.field}><label htmlFor="admin-order-to">{t('adminOrders.dateTo')}</label><Input id="admin-order-to" prefix={<CalendarDays aria-hidden />} type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></div>
      <div className={styles.filterAction}><Button icon={<RotateCcw size={16}/>} disabled={!hasFilters} onClick={reset}>{t('adminOrders.clear')}</Button></div>
    </FilterPanel>
    {query.isPending ? <ContentState state="loading" /> : query.isError ? <ContentState state="error" title={t('adminOrders.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} /> : <TablePanel title={t('adminOrders.title')} caption={t('pagination.total', { total: query.data.total })}><DataTable loading={query.isFetching} rowKey="id" columns={columns} dataSource={query.data.items} tableLayout="auto" scroll={{ x: 'max-content' }} emptyState={<EmptyState compact title={t('adminOrders.empty')} description={t('adminOrders.emptyDescription')} />} pagination={{...createTablePagination(20, (total) => t('pagination.total', { total })),current:page,total:query.data.total}} onChange={(pagination) => setPage(pagination.current ?? 1)} /></TablePanel>}
    <DetailDrawer title={`${t('adminOrders.order')} #${selected?.orderNumber ?? ''}`} subtitle={t('adminOrders.detailSubtitle')} width="min(760px, 100vw)" open={Boolean(selected)} onClose={() => setSelected(null)}>
      {selected ? <><DetailList items={[{ label: t('adminOrders.buyer'), value: selected.buyerName || '—' }, { label: t('adminOrders.shopId'), value: selected.shopName || (selected.shopId ? `#${selected.shopId}` : detail.data?.sellerOrders.map(order => order.shopName || (order.shopId ? `#${order.shopId}` : '—')).join(', ') || '—') }, { label: t('adminOrders.amount'), value: `${formatMoney(selected.totalAmount)} UZS` }, { label: t('adminOrders.payment'), value: selected.paymentMethod?.toUpperCase() || '—' }, { label: t('users.status'), value: <StatusTag status={selected.status} /> }, { label: t('users.createdAt'), value: selected.createdAt ? formatDateTime(selected.createdAt, locale) : '—' }]} />{detail.isPending ? <ContentState state="loading" /> : detail.isError ? <ContentState state="error" description={getAuthErrorMessage(detail.error)} onAction={() => void detail.refetch()} /> : <AppDetailNotice value={detail.data} />}</> : null}
    </DetailDrawer>
  </main>;
}
function AppDetailNotice({ value }: { value: AdminOrderDetail | undefined }) {
  const { locale, t } = useTranslation();
  if (!value) return null;
  const showDate = (date: string | null) => date ? formatDateTime(date, locale) : '—';
  const showStatus = (status: string | null) => status ? status.replaceAll('_', ' ') : '—';
  return <div className={styles.detailBlock}>
    <section className={styles.detailSection}>
      <header><h3>{t('adminOrders.subOrders')}</h3><span>{value.sellerOrders.length}</span></header>
      {value.sellerOrders.length ? <div className={styles.cardGrid}>{value.sellerOrders.map((order) => <article className={styles.detailCard} key={order.id}>
        <div className={styles.cardTitle}><strong>#{order.id}</strong><span>{showStatus(order.status)}</span></div>
        <DetailList items={[{ label: t('adminOrders.shopId'), value: order.shopName || (order.shopId ? `#${order.shopId}` : '—') }, { label: t('adminOrders.amount'), value: order.amount === null ? '—' : `${formatMoney(order.amount)} UZS` }, { label: t('users.createdAt'), value: showDate(order.createdAt) }]} />
      </article>)}</div> : <EmptyState compact title={t('adminOrders.noSubOrders')} />}
    </section>

    <section className={styles.detailSection}>
      <header><h3>{t('adminOrders.items')}</h3><span>{value.items.length}</span></header>
      {value.items.length ? <div className={styles.itemsTableWrap}><table className={styles.itemsTable}><thead><tr><th>{t('adminOrders.item')}</th><th>SKU</th><th>{t('adminOrders.quantity')}</th><th>{t('adminOrders.unitPrice')}</th><th>{t('adminOrders.total')}</th></tr></thead><tbody>{value.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.sku || '—'}</td><td>{item.quantity ?? '—'}</td><td>{item.unitPrice === null ? '—' : formatMoney(item.unitPrice)}</td><td>{item.totalPrice === null ? '—' : formatMoney(item.totalPrice)}</td></tr>)}</tbody></table></div> : <EmptyState compact title={t('adminOrders.noItems')} />}
    </section>

    <section className={styles.detailSection}>
      <header><h3>{t('adminOrders.shipments')}</h3><span>{value.shipments.length}</span></header>
      {value.shipments.length ? <div className={styles.cardGrid}>{value.shipments.map((shipment) => <article className={styles.detailCard} key={shipment.id}>
        <div className={styles.cardTitle}><strong>#{shipment.id}</strong><span>{showStatus(shipment.status)}</span></div>
        <DetailList items={[{ label: t('adminOrders.provider'), value: shipment.provider || '—' }, { label: t('adminOrders.tracking'), value: shipment.trackingUrl && /^https?:\/\//i.test(shipment.trackingUrl) ? <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">{t('adminOrders.openTracking')}</a> : '—' }, { label: t('users.createdAt'), value: showDate(shipment.createdAt) }]} />
      </article>)}</div> : <EmptyState compact title={t('adminOrders.noShipments')} />}
    </section>

    <section className={styles.detailSection}>
      <header><h3>{t('adminOrders.paymentDetail')}</h3></header>
      {value.payment ? <DetailList items={[{ label: t('adminOrders.payment'), value: showStatus(value.payment.method) }, { label: t('users.status'), value: showStatus(value.payment.status) }, { label: t('adminOrders.amount'), value: value.payment.amount === null ? '—' : `${formatMoney(value.payment.amount)} UZS` }, { label: t('adminOrders.transaction'), value: value.payment.transactionId || '—' }]} /> : <EmptyState compact title={t('adminOrders.noPayment')} />}
    </section>

    <section className={styles.detailSection}>
      <header><h3>{t('adminOrders.history')}</h3><span>{value.history.length}</span></header>
      {value.history.length ? <ol className={styles.history}>{value.history.map((entry) => <li key={entry.id}><span className={styles.historyDot} aria-hidden /><div><strong>{showStatus(entry.status)}</strong><small>{[entry.actorName, showDate(entry.createdAt)].filter((part) => part && part !== '—').join(' · ')}</small>{entry.note ? <p>{entry.note}</p> : null}</div></li>)}</ol> : <EmptyState compact title={t('adminOrders.noHistory')} />}
    </section>
  </div>;
}
