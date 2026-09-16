import { App, Button } from 'antd';
import type { Key } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Eye, Printer, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminOrdersByStatusesQuery } from '../../features/orders/api/orderQueries';
import type { AdminOrder, AdminOrderDetail, AdminOrderStatus, AdminPaymentMethod } from '../../features/orders/model/orderTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { FilterField } from '../../shared/ui/FilterPanel/FilterField';
import { FilterSelect } from '../../shared/ui/FilterPanel/FilterSelect';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import styles from './AdminOrdersPage.module.css';
import { formatDateTime } from '../../shared/lib/date';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { DetailList } from '../../shared/ui/DetailList/DetailList';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import type { TranslationKey } from '../../shared/i18n/translations';
import { SearchInput } from '../../shared/ui/SearchInput/SearchInput';
import { DateRangeFilter } from '../../shared/ui/DateRangeFilter/DateRangeFilter';
import { getAdminOrder } from '../../features/orders/api/orderApi';

type PaymentFilter = 'ALL' | AdminPaymentMethod;

const statuses: AdminOrderStatus[] = [
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
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
  const { message } = App.useApp();
  const { locale, t } = useTranslation();
  const navigate = useNavigate();
  const [statusesFilter, setStatusesFilter] = useState<AdminOrderStatus[]>([]); const [payment, setPayment] = useState<PaymentFilter>('ALL'); const [search, setSearch] = useState(''); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState(''); const [page, setPage] = useState(1); const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [printOrders, setPrintOrders] = useState<AdminOrderDetail[]>([]);
  const [printLoading, setPrintLoading] = useState(false);
  const deferredSearch = useDebouncedValue(search.trim());
  const query = useAdminOrdersByStatusesQuery({ page, limit: 20, ...(payment !== 'ALL' ? { paymentMethod: payment } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) }, statusesFilter, deferredSearch);
  const reset = () => { setStatusesFilter([]); setPayment('ALL'); setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const columns: ColumnsType<AdminOrder> = [
    { title: t('adminOrders.buyer'), dataIndex: 'buyerName', responsive: ['md'], render: (value: string | null) => value || '—' },
    { title: t('adminOrders.shopId'), dataIndex: 'shopId', responsive: ['lg'], render: (value: string | null, order) => order.shopName || (value ? `#${value}` : order.sellersCount ? t('adminOrders.shopCount', { count: order.sellersCount }) : '—') },
    { title: t('adminOrders.amount'), dataIndex: 'totalAmount', responsive: ['sm'], render: (value: number) => <span className={styles.amount}>{formatMoney(value)} UZS</span> },
    { title: t('adminOrders.payment'), dataIndex: 'paymentMethod', width: 100, render: (value: AdminPaymentMethod | null) => value ? value.toUpperCase() : '—' },
    { title: t('users.status'), dataIndex: 'status', width: 170, render: (value: AdminOrderStatus) => value === 'FULFILLED' ? <StatusTag status="SHIPMENT_CREATED" /> : <StatusTag status={value} /> },
    { title: t('users.createdAt'), dataIndex: 'createdAt', responsive: ['xl'], render: (value: string) => value ? formatDateTime(value, locale) : '—' },
    { title: t('users.actions'), width: 80, align: 'center', render: (_, order) => <span className={styles.rowActions}><Button type="text" icon={<Eye size={17}/>} aria-label={t('adminOrders.detail')} onClick={() => void navigate(`/admin/orders/${encodeURIComponent(order.id)}`, { state: { order } })} /></span> },
  ];
  const hasFilters = statusesFilter.length > 0 || payment !== 'ALL' || Boolean(search || dateFrom || dateTo);
  useEffect(() => {
    if (!printOrders.length) return;
    const frame = requestAnimationFrame(() => {
      window.print();
      setPrintOrders([]);
    });
    return () => cancelAnimationFrame(frame);
  }, [printOrders]);
  const printSelected = async () => {
    if (!selectedRowKeys.length || printLoading) return;
    setPrintLoading(true);
    try {
      setPrintOrders(await Promise.all(selectedRowKeys.map((id) => getAdminOrder(String(id)))));
    } catch (error) {
      void message.error(getAuthErrorMessage(error));
    } finally {
      setPrintLoading(false);
    }
  };
  return <main className={styles.page}><PageHeader title={t('adminOrders.title')} description={t('adminOrders.description')} />
    <FilterPanel className={styles.filterPanel} aria-label={t('adminOrders.filters')}>
      <FilterField className={styles.searchField} label={t('adminOrders.search')} htmlFor="admin-order-search"><SearchInput id="admin-order-search" value={search} placeholder={t('adminOrders.searchPlaceholder')} onValueChange={(value) => { setSearch(value); setPage(1); }} /></FilterField>
      <FilterField label={t('users.status')} htmlFor="admin-order-status"><FilterSelect<AdminOrderStatus[]> id="admin-order-status" mode="multiple" maxTagCount="responsive" showSearch value={statusesFilter} placeholder={t('users.allStatuses')} options={statuses.map((value) => ({value,label:value === 'FULFILLED' ? t('status.shipmentCreated') : t(statusLabelKeys[value])}))} onChange={(value) => { setStatusesFilter(value); setPage(1); }} /></FilterField>
      <FilterField label={t('adminOrders.payment')} htmlFor="admin-order-payment"><FilterSelect<PaymentFilter> id="admin-order-payment" value={payment} options={[{ value: 'ALL', label: t('adminOrders.allPayments') }, { value: 'online', label: 'Online' }, { value: 'cod', label: 'COD' }]} onChange={(value) => { setPayment(value); setPage(1); }} /></FilterField>
      <DateRangeFilter className={styles.dateRange} value={[dateFrom, dateTo]} startLabel={t('adminOrders.dateFrom')} endLabel={t('adminOrders.dateTo')} onChange={([from, to]) => { setDateFrom(from); setDateTo(to); setPage(1); }} />
      <div className={styles.filterAction}><Button icon={<RotateCcw size={16}/>} disabled={!hasFilters} onClick={reset}>{t('adminOrders.clear')}</Button></div>
    </FilterPanel>
    {query.isError ? <ContentState state="error" title={t('adminOrders.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} /> : query.isPending || !query.data ? <ContentState state="loading" /> : <TablePanel title={t('adminOrders.title')} caption={selectedRowKeys.length ? t('adminOrders.selected', { count: selectedRowKeys.length }) : t('pagination.total', { total: query.data.total })} action={<Button icon={<Printer size={16}/>} disabled={!selectedRowKeys.length} loading={printLoading} onClick={() => void printSelected()}>{t('adminOrders.print')}</Button>}><DataTable loading={query.isFetching} rowKey="id" rowSelection={{ selectedRowKeys, preserveSelectedRowKeys: true, onChange: setSelectedRowKeys }} columns={columns} dataSource={query.data.items} tableLayout="auto" scroll={{ x: 'max-content' }} emptyState={<EmptyState compact title={t('adminOrders.empty')} description={t('adminOrders.emptyDescription')} />} pagination={{...createTablePagination(20, (total) => t('pagination.total', { total })),current:page,total:query.data.total}} onChange={(pagination) => setPage(pagination.current ?? 1)} /></TablePanel>}
    <PrintableOrderLabels orders={printOrders} />
  </main>;
}

function PrintableOrderLabels({ orders }: { orders: AdminOrderDetail[] }) {
  return <section className={styles.printArea} aria-hidden={!orders.length}>{orders.map((detail, index) => {
    const order = detail.summary;
    const products = detail.items.map((item) => `${item.name} x${item.quantity ?? 1}`).join(', ') || '—';
    const shops = detail.sellerOrders.map((item) => item.shopName || (item.shopId ? `#${item.shopId}` : null)).filter(Boolean).join(', ') || order?.shopName || '—';
    return <article className={styles.shippingLabel} key={order?.id ?? index}>
      <div className={styles.labelAside}>
        <strong>ELCHI<br />POCHTA</strong>
        <div className={styles.qrPlaceholder} aria-label="QR kod uchun joy" />
        <b>{order?.createdAt ? order.createdAt.slice(0, 10).split('-').reverse().join('/') : '—'}</b>
      </div>
      <dl className={styles.labelDetails}>
        <div><dt>F.I.O:</dt><dd>{order?.buyerName || '—'}</dd></div>
        <div><dt>Telefon:</dt><dd>{order?.buyerPhone || '—'}</dd></div>
        <div><dt>Manzil:</dt><dd>{detail.deliveryAddress || '—'}</dd></div>
        <div><dt>Jami:</dt><dd>{order ? `${formatMoney(order.totalAmount)} so‘m` : '—'}</dd></div>
        <div><dt>Jo‘natuvchi:</dt><dd>{shops}</dd></div>
        <div><dt>Mahsulot:</dt><dd>{products}</dd></div>
        <div><dt>Mo‘ljal:</dt><dd>—</dd></div>
        <div><dt>Izoh:</dt><dd>{order ? `Marketplace buyurtma #${order.orderNumber}` : '—'}</dd></div>
      </dl>
    </article>;
  })}</section>;
}
export function AppDetailNotice({ value }: { value: AdminOrderDetail | undefined }) {
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
