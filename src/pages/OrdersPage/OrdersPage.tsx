import { Check, Eye, RotateCcw } from 'lucide-react';
import { App, Button, Descriptions, Drawer, Input, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import type { SellerOrder, SellerOrderStatus } from '../../features/orders/model/orderTypes';
import { useSellerOrdersQuery, useUpdateSellerOrderStatusMutation } from '../../features/orders/api/orderQueries';
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

type StatusFilter = 'ALL' | SellerOrderStatus;
const formatPrice = (value: number) => `${formatMoney(value)} so‘m`;
const formatDate = (value: string) => new Date(value).toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' });
const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Barcha holatlar' }, { value: 'NEW', label: 'Yangi' },
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
  const deferredSearch = useDebouncedValue(search.trim());
  const ordersQuery = useSellerOrdersQuery({
    page, limit: 20,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  });
  const updateStatusMutation = useUpdateSellerOrderStatusMutation();
  const orders = ordersQuery.data?.items ?? [];

  const resetPage = () => setPage(1);
  const resetFilters = () => { setSearch(''); setStatus('ALL'); setDateFrom(''); setDateTo(''); setPage(1); };
  const columns: ColumnsType<SellerOrder> = [
    { title: 'Buyurtma', width: 130, render: (_, order) => <span className={styles.orderId}><strong>#{order.salesOrderId}</strong><small>Ichki ID: {order.id}</small></span> },
    { title: 'Xaridor', dataIndex: 'buyerName', render: (name: string | null) => name || <span className={styles.muted}>Noma’lum xaridor</span> },
    { title: 'Tovarlar', dataIndex: 'itemsCount', align: 'center', width: 80, render: (count: number) => `${count} ta` },
    { title: 'To‘lov', width: 190, render: (_, order) => <span className={styles.amount}><strong>{formatPrice(order.subtotal)}</strong>{order.codAmount > 0 ? <small>COD: {formatPrice(order.codAmount)}</small> : <small>Oldindan to‘langan</small>}</span> },
    { title: 'Sana', dataIndex: 'createdAt', width: 150, render: formatDate },
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
      <DataTable rowKey="id" columns={columns} dataSource={orders} scroll={{ x: 760 }} emptyState={<EmptyState compact title="Buyurtmalar topilmadi" description="Yangi buyurtmalar kelganda shu yerda ko‘rinadi." />} pagination={ordersQuery.data.total > 20 ? { ...createTablePagination(20), current: page, total: ordersQuery.data.total } : false} onChange={(pagination) => setPage(pagination.current ?? 1)} />
    </TablePanel>
    <Drawer title={`Buyurtma #${selectedOrder?.salesOrderId ?? ''}`} width={480} open={Boolean(selectedOrder)} onClose={() => { if (!updateStatusMutation.isPending) setSelectedOrder(null); }}>
      {selectedOrder ? <>
        <Typography.Text className={styles.drawerCaption}>Buyurtma va yetkazib berish ma’lumotlari</Typography.Text>
        <Descriptions className={styles.details} column={1} bordered size="small">
          <Descriptions.Item label="Xaridor">{selectedOrder.buyerName || 'Noma’lum'}</Descriptions.Item>
          <Descriptions.Item label="Tovarlar">{selectedOrder.itemsCount} ta</Descriptions.Item>
          <Descriptions.Item label="Summa">{formatPrice(selectedOrder.subtotal)}</Descriptions.Item>
          <Descriptions.Item label="Yetkazishda undirish">{formatPrice(selectedOrder.codAmount)}</Descriptions.Item>
          <Descriptions.Item label="Holati"><StatusTag status={selectedOrder.status} /></Descriptions.Item>
        </Descriptions>
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
        <ElchiTimeline order={selectedOrder} />
      </> : null}
    </Drawer>
  </main>;
}
