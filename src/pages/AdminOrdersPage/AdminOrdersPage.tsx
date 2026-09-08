import { Button, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CalendarDays, Eye, RotateCcw, Search } from 'lucide-react';
import { useState } from 'react';
import { useAdminOrderQuery, useAdminOrdersQuery } from '../../features/orders/api/orderQueries';
import type { AdminOrder, AdminOrderStatus, AdminPaymentMethod } from '../../features/orders/model/orderTypes';
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

export default function AdminOrdersPage() {
  const { language, t } = useTranslation();
  const [status, setStatus] = useState<StatusFilter>('ALL'); const [payment, setPayment] = useState<PaymentFilter>('ALL'); const [shopId, setShopId] = useState(''); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState(''); const [page, setPage] = useState(1); const [selected, setSelected] = useState<AdminOrder | null>(null);
  const deferredShopId = useDebouncedValue(shopId.trim());
  const query = useAdminOrdersQuery({ page, limit: 20, ...(status !== 'ALL' ? { status } : {}), ...(payment !== 'ALL' ? { paymentMethod: payment } : {}), ...(deferredShopId ? { shopId: deferredShopId } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) });
  const detail = useAdminOrderQuery(selected?.id ?? null); const reset = () => { setStatus('ALL'); setPayment('ALL'); setShopId(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const columns: ColumnsType<AdminOrder> = [
    { title: t('adminOrders.order'), render: (_, order) => `#${order.orderNumber}` },
    { title: t('adminOrders.buyer'), dataIndex: 'buyerName', responsive: ['md'], render: (value: string | null) => value || '—' },
    { title: t('adminOrders.shopId'), dataIndex: 'shopId', responsive: ['lg'], render: (value: string | null) => value ? `#${value}` : '—' },
    { title: t('adminOrders.amount'), dataIndex: 'totalAmount', responsive: ['sm'], render: (value: number) => <span className={styles.amount}>{formatMoney(value)} UZS</span> },
    { title: t('adminOrders.payment'), dataIndex: 'paymentMethod', width: 100, render: (value: AdminPaymentMethod | null) => value ? value.toUpperCase() : '—' },
    { title: t('users.status'), dataIndex: 'status', width: 170, render: (value: AdminOrderStatus) => <StatusTag status={value} /> },
    { title: t('users.createdAt'), dataIndex: 'createdAt', responsive: ['xl'], render: (value: string) => value ? formatDateTime(value, language) : '—' },
    { title: t('users.actions'), width: 80, align: 'center', render: (_, order) => <span className={styles.rowActions}><Button type="text" icon={<Eye size={17}/>} aria-label={t('adminOrders.detail')} onClick={() => setSelected(order)} /></span> },
  ];
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title={t('adminOrders.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />;
  const hasFilters = status !== 'ALL' || payment !== 'ALL' || Boolean(shopId || dateFrom || dateTo);
  return <main className={styles.page}><PageHeader title={t('adminOrders.title')} description={t('adminOrders.description')} />
    <FilterPanel className={styles.filterPanel} aria-label={t('adminOrders.filters')}>
      <div className={`${styles.field} ${styles.marketField}`}><label htmlFor="admin-order-market">{t('adminOrders.shopId')}</label><Input id="admin-order-market" prefix={<Search aria-hidden />} value={shopId} inputMode="numeric" placeholder={t('adminOrders.shopIdPlaceholder')} allowClear onChange={(event) => { setShopId(event.target.value.replace(/\D/g, '')); setPage(1); }} /></div>
      <div className={styles.field}><label htmlFor="admin-order-status">{t('users.status')}</label><Select<StatusFilter> id="admin-order-status" value={status} options={[{value:'ALL',label:t('users.allStatuses')}, ...statuses.map((value) => ({value,label:value}))]} onChange={(value) => { setStatus(value); setPage(1); }} /></div>
      <div className={styles.field}><label htmlFor="admin-order-payment">{t('adminOrders.payment')}</label><Select<PaymentFilter> id="admin-order-payment" value={payment} options={[{ value: 'ALL', label: t('adminOrders.allPayments') }, { value: 'online', label: 'Online' }, { value: 'cod', label: 'COD' }]} onChange={(value) => { setPayment(value); setPage(1); }} /></div>
      <div className={styles.field}><label htmlFor="admin-order-from">{t('adminOrders.dateFrom')}</label><Input id="admin-order-from" prefix={<CalendarDays aria-hidden />} type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></div>
      <div className={styles.field}><label htmlFor="admin-order-to">{t('adminOrders.dateTo')}</label><Input id="admin-order-to" prefix={<CalendarDays aria-hidden />} type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></div>
      <div className={styles.filterAction}><Button icon={<RotateCcw size={16}/>} disabled={!hasFilters} onClick={reset}>{t('adminOrders.clear')}</Button></div>
    </FilterPanel>
    <div className={styles.tablePanel}><DataTable rowKey="id" columns={columns} dataSource={query.data.items} tableLayout="auto" scroll={{ x: 'max-content' }} emptyState={<EmptyState compact title={t('adminOrders.empty')} description={t('adminOrders.emptyDescription')} />} pagination={{...createTablePagination(20, (total) => t('pagination.total', { total })),current:page,total:query.data.total}} onChange={(pagination) => setPage(pagination.current ?? 1)} /></div>
    <DetailDrawer title={`${t('adminOrders.order')} #${selected?.orderNumber ?? ''}`} subtitle="Buyurtma tafsilotlari" open={Boolean(selected)} onClose={() => setSelected(null)}>
      {selected ? <><DetailList items={[{ label: t('adminOrders.buyer'), value: selected.buyerName || '—' }, { label: t('adminOrders.shopId'), value: selected.shopId ? `#${selected.shopId}` : '—' }, { label: t('adminOrders.amount'), value: `${formatMoney(selected.totalAmount)} UZS` }, { label: t('adminOrders.payment'), value: selected.paymentMethod?.toUpperCase() || '—' }, { label: t('users.status'), value: <StatusTag status={selected.status} /> }]} />{detail.isPending ? <ContentState state="loading" /> : detail.isError ? <ContentState state="error" description={getAuthErrorMessage(detail.error)} onAction={() => void detail.refetch()} /> : <AppDetailNotice value={detail.data} />}</> : null}
    </DetailDrawer>
  </main>;
}
function AppDetailNotice({ value }: { value: unknown }) { if (typeof value !== 'object' || value === null) return null; const record = value as Record<string, unknown>; const count = (key: string) => Array.isArray(record[key]) ? record[key].length : 0; return <div className={styles.detailBlock}><DetailList items={[{ label: 'Seller buyurtmalari', value: count('sellerOrders') }, { label: 'Mahsulotlar', value: count('items') }, { label: 'Jo‘natma', value: record.shipment ? 'Mavjud' : '—' }, { label: 'To‘lov', value: record.payment ? 'Mavjud' : '—' }]} /></div>; }
