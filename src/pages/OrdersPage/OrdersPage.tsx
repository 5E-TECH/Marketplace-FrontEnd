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

type StatusFilter = 'ALL' | SellerOrderStatus;
const formatPrice = (value: number) => `${formatMoney(value)} so‘m`;
const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Barcha holatlar' },
  { value: 'CONFIRMED', label: 'Tasdiqlangan' }, { value: 'PENDING', label: 'Kutilmoqda' },
  { value: 'SHIPMENT_CREATED', label: 'Elchi yaratildi' }, { value: 'ON_THE_ROAD', label: 'Yo‘lda' },
  { value: 'DELIVERED', label: 'Yetkazildi' }, { value: 'CANCELLED', label: 'Bekor qilindi' },
  { value: 'RETURNED', label: 'Qaytarildi' },
];

export default function OrdersPage() {
  const { message } = App.useApp();
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
    { title: 'Buyurtma', width: 130, render: (_, order) => <span className={styles.orderId}><strong>#{order.salesOrderId}</strong><small>Ichki ID: {order.id}</small></span> },
    { title: 'Xaridor', dataIndex: 'buyerName', responsive: ['md'], render: (name: string | null) => name || <span className={styles.muted}>Noma’lum xaridor</span> },
    { title: 'Tovarlar', dataIndex: 'itemsCount', align: 'center', width: 80, responsive: ['lg'], render: (count: number) => `${count} ta` },
    { title: 'To‘lov', width: 190, responsive: ['sm'], render: (_, order) => <span className={styles.amount}><strong>{formatPrice(order.subtotal)}</strong>{order.codAmount > 0 ? <small>COD: {formatPrice(order.codAmount)}</small> : <small>Oldindan to‘langan</small>}</span> },
    { title: 'Sana', dataIndex: 'createdAt', width: 150, responsive: ['xl'], render: (value: string) => formatDateTime(value) },
    { title: 'Holati', dataIndex: 'status', width: 140, render: (value: SellerOrderStatus) => <StatusTag status={value} /> },
    { title: '', width: 48, render: (_, order) => <Button type="text" icon={<Eye size={17} />} aria-label={`#${order.salesOrderId} buyurtmani ko‘rish`} onClick={() => { setSelectedOrder(order); setNextStatus(order.status); }} /> },
  ];

  if (ordersQuery.isPending) return <ContentState state="loading" />;
  if (ordersQuery.isError) return <ContentState state="error" title="Buyurtmalarni yuklab bo‘lmadi" description={getAuthErrorMessage(ordersQuery.error)} onAction={() => void ordersQuery.refetch()} />;

  return <main className={styles.page}>
    <PageHeader title="Buyurtmalar" description="Buyurtmalar va Elchi yetkazib berish holatini kuzating" />
    <ListToolbar value={search} placeholder="Order ID, sales order ID yoki xaridor ismi..." onChange={(value) => { setSearch(value); resetPage(); }} actions={<>
      <Select<StatusFilter> className={styles.statusFilter} value={status} options={statusOptions} title="Buyurtma holati" onChange={(value) => { setStatus(value); resetPage(); }} />
      <label className={styles.dateField}><span>Dan</span><Input className={styles.dateFilter} type="date" aria-label="Boshlanish sanasi" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); resetPage(); }} /></label>
      <label className={styles.dateField}><span>Gacha</span><Input className={styles.dateFilter} type="date" aria-label="Tugash sanasi" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); resetPage(); }} /></label>
      {search || status !== 'ALL' || dateFrom || dateTo ? <Button icon={<RotateCcw size={16} />} onClick={resetFilters}>Tozalash</Button> : null}
    </>} />
    <TablePanel className={styles.tableCard} title="Buyurtmalar ro‘yxati" caption={`${ordersQuery.data.total} ta natija`}>
      <DataTable rowKey="id" columns={columns} dataSource={orders} tableLayout="auto" emptyState={<EmptyState compact title="Buyurtmalar topilmadi" description="Yangi buyurtmalar kelganda shu yerda ko‘rinadi." />} pagination={ordersQuery.data.total > 20 ? { ...createTablePagination(20), current: page, total: ordersQuery.data.total } : false} onChange={(pagination) => setPage(pagination.current ?? 1)} />
    </TablePanel>
    <DetailDrawer title={`Buyurtma #${selectedOrder?.salesOrderId ?? ''}`} subtitle="Buyurtma va yetkazib berish ma’lumotlari" width="min(560px, 100vw)" open={Boolean(selectedOrder)} onClose={() => { if (!updateStatusMutation.isPending) setSelectedOrder(null); }}>
      {selectedOrder ? <>
        <DetailList items={[{ label: 'Xaridor', value: selectedOrder.buyerName || 'Noma’lum' }, { label: 'Tovarlar', value: `${selectedOrder.itemsCount} ta` }, { label: 'Summa', value: formatPrice(selectedOrder.subtotal) }, { label: 'Yetkazishda undirish', value: formatPrice(selectedOrder.codAmount) }, { label: 'Holati', value: <StatusTag status={selectedOrder.status} /> }]} />
        <div className={styles.quickActions}>
          <Popconfirm title="Buyurtmani tasdiqlaysizmi?" disabled={!canConfirm} onConfirm={() => confirmMutation.mutate(selectedOrder.id, { onSuccess: () => { setSelectedOrder((current) => current ? { ...current, status: 'CONFIRMED' } : current); setNextStatus('CONFIRMED'); void message.success('Buyurtma tasdiqlandi'); }, onError: (error) => void message.error(getAuthErrorMessage(error)) })}><Button type="primary" icon={<Check size={16} />} disabled={!canConfirm} loading={confirmMutation.isPending}>Tasdiqlash</Button></Popconfirm>
          <Popconfirm title="Buyurtmani bekor qilasizmi?" description="Bu amal buyurtma holatini bekor qilingan holatga o‘tkazadi." disabled={!canCancel} onConfirm={() => cancelMutation.mutate(selectedOrder.id, { onSuccess: () => { setSelectedOrder((current) => current ? { ...current, status: 'CANCELLED' } : current); setNextStatus('CANCELLED'); void message.success('Buyurtma bekor qilindi'); }, onError: (error) => void message.error(getAuthErrorMessage(error)) })}><Button danger icon={<Ban size={16} />} disabled={!canCancel} loading={cancelMutation.isPending}>Bekor qilish</Button></Popconfirm>
        </div>
        <section className={styles.statusEditor} aria-label="Buyurtma statusini yangilash">
          <div><strong>Statusni yangilash</strong><span>Seller yoki operator buyurtma holatini o‘zgartirishi mumkin.</span></div>
          <Select<SellerOrderStatus> aria-label="Yangi status" value={nextStatus ?? selectedOrder.status} options={statusOptions.filter((option): option is { value: SellerOrderStatus; label: string } => option.value !== 'ALL')} disabled={updateStatusMutation.isPending} onChange={setNextStatus} />
          <Button type="primary" icon={<Check size={16} />} loading={updateStatusMutation.isPending} disabled={!nextStatus || nextStatus === selectedOrder.status} onClick={() => {
            if (!nextStatus) return;
            const submittedStatus = nextStatus;
            updateStatusMutation.mutate({ id: selectedOrder.id, status: submittedStatus }, {
              onSuccess: () => {
                setSelectedOrder((current) => current ? { ...current, status: submittedStatus } : current);
                void message.success('Buyurtma statusi yangilandi');
              },
              onError: (error) => void message.error(getAuthErrorMessage(error)),
            });
          }}>Statusni saqlash</Button>
        </section>
        <section className={styles.shipmentEditor} aria-label="Elchi jo‘natmasini yaratish">
          <div><strong>Elchi jo‘natmasi</strong><span>Xaridor telefonini xalqaro formatda kiriting.</span></div>
          <Input value={customerPhone} placeholder="+998901234567" inputMode="tel" maxLength={13} onChange={(event) => setCustomerPhone(event.target.value.replace(/[^+\d]/g, ''))} />
          <Button icon={<Truck size={16} />} loading={shipmentMutation.isPending} disabled={!canCreateShipment || !/^\+998\d{9}$/.test(customerPhone)} onClick={() => shipmentMutation.mutate({ id: selectedOrder.id, customerPhone }, { onSuccess: () => { setCustomerPhone(''); setSelectedOrder((current) => current ? { ...current, status: 'SHIPMENT_CREATED' } : current); setNextStatus('SHIPMENT_CREATED'); void message.success('Elchi jo‘natmasi yaratildi'); }, onError: (error) => void message.error(getAuthErrorMessage(error)) })}>Jo‘natma yaratish</Button>
        </section>
        <Tabs className={styles.orderTabs} items={[
          { key: 'detail', label: 'Tafsilotlar', children: <ApiDataState query={detailQuery} empty="Tafsilotlar mavjud emas" /> },
          { key: 'items', label: 'Tovarlar', children: <ApiDataState query={itemsQuery} empty="Tovarlar mavjud emas" /> },
          { key: 'history', label: 'Tarix', children: <ApiDataState query={historyQuery} empty="Status tarixi mavjud emas" /> },
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
