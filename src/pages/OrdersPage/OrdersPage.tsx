import { Ban, Check, Eye, RotateCcw, Truck } from 'lucide-react';
import { App, Button, Input, Popconfirm, Select, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import type { SellerOrder, SellerOrderStatus } from '../../features/orders/model/orderTypes';
import { useCancelSellerOrderMutation, useConfirmSellerOrderMutation, useCreateSellerShipmentMutation, useSellerOrderHistoryQuery, useSellerOrderItemsQuery, useSellerOrderQuery, useSellerOrdersQuery, useUpdateSellerOrderStatusMutation } from '../../features/orders/api/orderQueries';
import { ElchiTimeline } from '../../features/orders/ui/ElchiTimeline/ElchiTimeline';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { ListToolbar } from '../../shared/ui/ListToolbar/ListToolbar';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import styles from './OrdersPage.module.css';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { formatDateTime } from '../../shared/lib/date';
import { DetailDrawer } from '../../shared/ui/DetailDrawer/DetailDrawer';
import { DetailList } from '../../shared/ui/DetailList/DetailList';
import { useTranslation } from '../../shared/i18n/useTranslation';

type StatusFilter = 'ALL' | SellerOrderStatus;
export default function OrdersPage() {
  const { message } = App.useApp();
  const { locale, t } = useTranslation();
  const formatPrice = (value: number) => `${formatMoney(value)} ${t('product.currency')}`;
  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'ALL', label: t('order.allStatuses') },
    { value: 'CONFIRMED', label: t('status.confirmed') }, { value: 'PENDING', label: t('status.pending') },
    { value: 'SHIPMENT_CREATED', label: t('status.shipmentCreated') }, { value: 'ON_THE_ROAD', label: t('status.onTheRoad') },
    { value: 'DELIVERED', label: t('status.delivered') }, { value: 'CANCELLED', label: t('status.cancelled') },
    { value: 'RETURNED', label: t('status.returned') },
  ];
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [nextStatus, setNextStatus] = useState<SellerOrderStatus | null>(null);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [customerPhone, setCustomerPhone] = useState('');
  const deferredSearch = useDebouncedValue(search.trim());
  const ordersQuery = useSellerOrdersQuery({
    page, limit: 20,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  });
  const updateStatusMutation = useUpdateSellerOrderStatusMutation();
  const detailQuery = useSellerOrderQuery(selectedOrder?.id ?? null);
  const itemsQuery = useSellerOrderItemsQuery(selectedOrder?.id ?? null);
  const historyQuery = useSellerOrderHistoryQuery(selectedOrder?.id ?? null);
  const confirmMutation = useConfirmSellerOrderMutation();
  const cancelMutation = useCancelSellerOrderMutation();
  const shipmentMutation = useCreateSellerShipmentMutation();
  const orders = ordersQuery.data?.items ?? [];
  const canConfirm = selectedOrder?.status === 'PENDING' || selectedOrder?.status === 'NEW';
  const canCancel = Boolean(selectedOrder && !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(selectedOrder.status));
  const canCreateShipment = selectedOrder?.status === 'CONFIRMED' && !selectedOrder.elchiShipmentId;

  const resetPage = () => setPage(1);
  const resetFilters = () => { setSearch(''); setStatus('ALL'); setDateFrom(''); setDateTo(''); setPage(1); };
  const columns: ColumnsType<SellerOrder> = [
    { title: t('order.order'), width: 130, render: (_, order) => <span className={styles.orderId}><strong>#{order.salesOrderId}</strong><small>{t('order.internalId', { id: order.id })}</small></span> },
    { title: t('order.buyer'), dataIndex: 'buyerName', responsive: ['md'], render: (name: string | null) => name || <span className={styles.muted}>{t('order.unknownBuyer')}</span> },
    { title: t('order.items'), dataIndex: 'itemsCount', align: 'center', width: 80, responsive: ['lg'], render: (count: number) => t('order.itemCount', { count }) },
    { title: t('order.payment'), width: 190, responsive: ['sm'], render: (_, order) => <span className={styles.amount}><strong>{formatPrice(order.subtotal)}</strong>{order.codAmount > 0 ? <small>COD: {formatPrice(order.codAmount)}</small> : <small>{t('order.prepaid')}</small>}</span> },
    { title: t('order.date'), dataIndex: 'createdAt', width: 150, responsive: ['xl'], render: (value: string) => formatDateTime(value, locale) },
    { title: t('common.status'), dataIndex: 'status', width: 140, render: (value: SellerOrderStatus) => <StatusTag status={value} /> },
    { title: '', width: 48, render: (_, order) => <Button type="text" icon={<Eye size={17} />} aria-label={t('order.viewAria', { id: order.salesOrderId })} onClick={() => { setSelectedOrder(order); setNextStatus(order.status); }} /> },
  ];

  if (ordersQuery.isPending) return <ContentState state="loading" />;
  if (ordersQuery.isError) return <ContentState state="error" title={t('order.loadError')} description={getAuthErrorMessage(ordersQuery.error)} onAction={() => void ordersQuery.refetch()} />;

  return <main className={styles.page}>
    <PageHeader title={t('order.title')} description={t('order.description')} />
    <ListToolbar value={search} placeholder={t('order.search')} onChange={(value) => { setSearch(value); resetPage(); }} actions={<>
      <Select<StatusFilter> className={styles.statusFilter} value={status} options={statusOptions} title={t('order.status')} onChange={(value) => { setStatus(value); resetPage(); }} />
      <label className={styles.dateField}><span>{t('order.from')}</span><Input className={styles.dateFilter} type="date" aria-label={t('order.startDate')} value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); resetPage(); }} /></label>
      <label className={styles.dateField}><span>{t('order.to')}</span><Input className={styles.dateFilter} type="date" aria-label={t('order.endDate')} value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); resetPage(); }} /></label>
      {search || status !== 'ALL' || dateFrom || dateTo ? <Button icon={<RotateCcw size={16} />} onClick={resetFilters}>{t('adminOrders.clear')}</Button> : null}
    </>} />
    <TablePanel className={styles.tableCard} title={t('order.list')} caption={t('order.resultCount', { count: ordersQuery.data.total })}>
      <DataTable rowKey="id" columns={columns} dataSource={orders} tableLayout="auto" emptyState={<EmptyState compact title={t('order.empty')} description={t('order.emptyDescription')} />} pagination={ordersQuery.data.total > 20 ? { ...createTablePagination(20, (total) => t('pagination.total', { total })), current: page, total: ordersQuery.data.total } : false} onChange={(pagination) => setPage(pagination.current ?? 1)} />
    </TablePanel>
    <DetailDrawer title={t('order.detailTitle', { id: selectedOrder?.salesOrderId ?? '' })} subtitle={t('order.detailDescription')} width="min(560px, 100vw)" open={Boolean(selectedOrder)} onClose={() => { if (!updateStatusMutation.isPending) setSelectedOrder(null); }}>
      {selectedOrder ? <>
        <DetailList items={[{ label: t('order.buyer'), value: selectedOrder.buyerName || t('common.unknown') }, { label: t('order.items'), value: t('order.itemCount', { count: selectedOrder.itemsCount }) }, { label: t('order.amount'), value: formatPrice(selectedOrder.subtotal) }, { label: t('order.codAmount'), value: formatPrice(selectedOrder.codAmount) }, { label: t('common.status'), value: <StatusTag status={selectedOrder.status} /> }]} />
        <div className={styles.quickActions}>
          <Popconfirm title={t('order.confirmQuestion')} disabled={!canConfirm} onConfirm={() => confirmMutation.mutate(selectedOrder.id, { onSuccess: () => { setSelectedOrder((current) => current ? { ...current, status: 'CONFIRMED' } : current); setNextStatus('CONFIRMED'); void message.success(t('order.confirmed')); }, onError: (error) => void message.error(getAuthErrorMessage(error)) })}><Button type="primary" icon={<Check size={16} />} disabled={!canConfirm} loading={confirmMutation.isPending}>{t('common.confirm')}</Button></Popconfirm>
          <Popconfirm title={t('order.cancelQuestion')} description={t('order.cancelDescription')} disabled={!canCancel} onConfirm={() => cancelMutation.mutate(selectedOrder.id, { onSuccess: () => { setSelectedOrder((current) => current ? { ...current, status: 'CANCELLED' } : current); setNextStatus('CANCELLED'); void message.success(t('order.cancelled')); }, onError: (error) => void message.error(getAuthErrorMessage(error)) })}><Button danger icon={<Ban size={16} />} disabled={!canCancel} loading={cancelMutation.isPending}>{t('common.cancel')}</Button></Popconfirm>
        </div>
        <section className={styles.statusEditor} aria-label={t('order.updateStatus')}>
          <div><strong>{t('order.updateStatus')}</strong><span>{t('order.updateStatusDescription')}</span></div>
          <Select<SellerOrderStatus> aria-label={t('order.newStatus')} value={nextStatus ?? selectedOrder.status} options={statusOptions.filter((option): option is { value: SellerOrderStatus; label: string } => option.value !== 'ALL')} disabled={updateStatusMutation.isPending} onChange={setNextStatus} />
          <Button type="primary" icon={<Check size={16} />} loading={updateStatusMutation.isPending} disabled={!nextStatus || nextStatus === selectedOrder.status} onClick={() => {
            if (!nextStatus) return;
            const submittedStatus = nextStatus;
            updateStatusMutation.mutate({ id: selectedOrder.id, status: submittedStatus }, {
              onSuccess: () => {
                setSelectedOrder((current) => current ? { ...current, status: submittedStatus } : current);
                void message.success(t('order.statusUpdated'));
              },
              onError: (error) => void message.error(getAuthErrorMessage(error)),
            });
          }}>{t('order.saveStatus')}</Button>
        </section>
        <section className={styles.shipmentEditor} aria-label={t('order.createShipment')}>
          <div><strong>{t('order.shipment')}</strong><span>{t('order.phoneDescription')}</span></div>
          <Input value={customerPhone} placeholder="+998901234567" inputMode="tel" maxLength={13} onChange={(event) => setCustomerPhone(event.target.value.replace(/[^+\d]/g, ''))} />
          <Button icon={<Truck size={16} />} loading={shipmentMutation.isPending} disabled={!canCreateShipment || !/^\+998\d{9}$/.test(customerPhone)} onClick={() => shipmentMutation.mutate({ id: selectedOrder.id, customerPhone }, { onSuccess: () => { setCustomerPhone(''); setSelectedOrder((current) => current ? { ...current, status: 'SHIPMENT_CREATED' } : current); setNextStatus('SHIPMENT_CREATED'); void message.success(t('order.shipmentCreated')); }, onError: (error) => void message.error(getAuthErrorMessage(error)) })}>{t('order.createShipment')}</Button>
        </section>
        <Tabs className={styles.orderTabs} items={[
          { key: 'detail', label: t('order.details'), children: <ApiDataState query={detailQuery} empty={t('order.noDetails')} /> },
          { key: 'items', label: t('order.items'), children: <ApiDataState query={itemsQuery} empty={t('order.noItems')} /> },
          { key: 'history', label: t('order.history'), children: <ApiDataState query={historyQuery} empty={t('order.noHistory')} /> },
        ]} />
        <ElchiTimeline order={selectedOrder} />
      </> : null}
    </DetailDrawer>
  </main>;
}

function ApiDataState({ query, empty }: { query: { isPending: boolean; isError: boolean; data?: unknown; refetch: () => unknown }; empty: string }) {
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" onAction={() => void query.refetch()} />;
  const value = query.data;
  const entries: Array<[string, unknown]> = Array.isArray(value)
    ? value.map((item: unknown, index) => [String(index + 1), item])
    : value && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>)
      : [];
  if (!entries.length) return <EmptyState compact title={empty} />;
  return <div className={styles.apiData}>{entries.map(([key, raw]) => {
    const text = raw === null || raw === undefined
      ? '—'
      : typeof raw === 'object'
        ? JSON.stringify(raw)
        : typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
          ? String(raw)
          : '—';
    return <div key={key}><span>{key}</span><strong>{text}</strong></div>;
  })}</div>;
}
