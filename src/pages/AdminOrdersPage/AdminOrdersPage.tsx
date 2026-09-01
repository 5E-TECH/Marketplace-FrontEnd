import { Button, Descriptions, Drawer, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Eye, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useAdminOrderQuery, useAdminOrdersQuery } from '../../features/orders/api/orderQueries';
import type { AdminOrder, PaymentMethod, SellerOrderStatus } from '../../features/orders/model/orderTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { ListToolbar } from '../../shared/ui/ListToolbar/ListToolbar';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import styles from './AdminOrdersPage.module.css';

type StatusFilter = 'ALL' | SellerOrderStatus; type PaymentFilter = 'ALL' | PaymentMethod;
const statuses: SellerOrderStatus[] = ['NEW','PENDING','CONFIRMED','SHIPMENT_CREATED','ON_THE_ROAD','DELIVERED','CANCELLED','RETURNED'];
export default function AdminOrdersPage() {
  const { language, t } = useTranslation();
  const [status, setStatus] = useState<StatusFilter>('ALL'); const [payment, setPayment] = useState<PaymentFilter>('ALL'); const [shopId, setShopId] = useState(''); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState(''); const [page, setPage] = useState(1); const [selected, setSelected] = useState<AdminOrder | null>(null);
  const query = useAdminOrdersQuery({ page, limit: 20, ...(status !== 'ALL' ? { status } : {}), ...(payment !== 'ALL' ? { paymentMethod: payment } : {}), ...(shopId.trim() ? { shopId: shopId.trim() } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) });
  const detail = useAdminOrderQuery(selected?.id ?? null); const reset = () => { setStatus('ALL'); setPayment('ALL'); setShopId(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const columns: ColumnsType<AdminOrder> = [
    { title: t('adminOrders.order'), render: (_, order) => `#${order.orderNumber}` },
    { title: t('adminOrders.buyer'), dataIndex: 'buyerName', responsive: ['md'], render: (value: string | null) => value || '—' },
    { title: t('adminOrders.shopId'), dataIndex: 'shopId', responsive: ['lg'], render: (value: string | null) => value ? `#${value}` : '—' },
    { title: t('adminOrders.amount'), dataIndex: 'totalAmount', responsive: ['sm'], render: (value: number) => <span className={styles.amount}>{formatMoney(value)} UZS</span> },
    { title: t('adminOrders.payment'), dataIndex: 'paymentMethod', width: 100, render: (value: PaymentMethod | null) => value || '—' },
    { title: t('users.status'), dataIndex: 'status', width: 140, render: (value: SellerOrderStatus) => <StatusTag status={value} /> },
    { title: t('users.createdAt'), dataIndex: 'createdAt', responsive: ['xl'], render: (value: string) => value ? new Date(value).toLocaleString(language) : '—' },
    { title: '', width: 48, render: (_, order) => <Button type="text" icon={<Eye size={17}/>} aria-label={t('adminOrders.detail')} onClick={() => setSelected(order)} /> },
  ];
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title={t('adminOrders.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />;
  return <main className={styles.page}><PageHeader title={t('adminOrders.title')} description={t('adminOrders.description')} />
    <ListToolbar value={shopId} placeholder={t('adminOrders.shopId')} onChange={(value) => { setShopId(value.replace(/\D/g, '')); setPage(1); }} actions={<div className={styles.filters}>
      <Select<StatusFilter> className={styles.filter} value={status} options={[{value:'ALL',label:t('users.allStatuses')}, ...statuses.map((value) => ({value,label:value}))]} onChange={(value) => { setStatus(value); setPage(1); }} />
      <Select<PaymentFilter> className={styles.filter} value={payment} options={['ALL','COD','PAYME','CLICK'].map((value) => ({value,label:value === 'ALL' ? t('adminOrders.allPayments') : value}))} onChange={(value) => { setPayment(value); setPage(1); }} />
      <Input type="date" value={dateFrom} max={dateTo || undefined} aria-label={t('adminOrders.dateFrom')} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
      <Input type="date" value={dateTo} min={dateFrom || undefined} aria-label={t('adminOrders.dateTo')} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
      {(status !== 'ALL' || payment !== 'ALL' || shopId || dateFrom || dateTo) ? <Button icon={<RotateCcw size={16}/>} onClick={reset}>{t('adminOrders.clear')}</Button> : null}
    </div>} />
    <DataTable rowKey="id" columns={columns} dataSource={query.data.items} tableLayout="auto" emptyState={<EmptyState compact title={t('adminOrders.empty')} description={t('adminOrders.emptyDescription')} />} pagination={{...createTablePagination(20),current:page,total:query.data.total}} onChange={(pagination) => setPage(pagination.current ?? 1)} />
    <Drawer title={`${t('adminOrders.order')} #${selected?.orderNumber ?? ''}`} width={520} open={Boolean(selected)} onClose={() => setSelected(null)}>
      {selected ? <><Descriptions className={styles.details} column={1} bordered size="small"><Descriptions.Item label={t('adminOrders.buyer')}>{selected.buyerName || '—'}</Descriptions.Item><Descriptions.Item label={t('adminOrders.shopId')}>{selected.shopId || '—'}</Descriptions.Item><Descriptions.Item label={t('adminOrders.amount')}>{formatMoney(selected.totalAmount)} UZS</Descriptions.Item><Descriptions.Item label={t('adminOrders.payment')}>{selected.paymentMethod || '—'}</Descriptions.Item><Descriptions.Item label={t('users.status')}><StatusTag status={selected.status}/></Descriptions.Item></Descriptions>{detail.isPending ? <ContentState state="loading" /> : detail.isError ? <ContentState state="error" description={getAuthErrorMessage(detail.error)} onAction={() => void detail.refetch()} /> : <AppDetailNotice value={detail.data} />}</> : null}
    </Drawer>
  </main>;
}
function AppDetailNotice({ value }: { value: unknown }) { if (typeof value !== 'object' || value === null) return null; const record = value as Record<string, unknown>; const count = (key: string) => Array.isArray(record[key]) ? record[key].length : 0; return <Descriptions className={styles.details} column={1} bordered size="small"><Descriptions.Item label="Seller sub-orders">{count('sellerOrders')}</Descriptions.Item><Descriptions.Item label="Items">{count('items')}</Descriptions.Item><Descriptions.Item label="Shipment">{record.shipment ? '✓' : '—'}</Descriptions.Item><Descriptions.Item label="Payment">{record.payment ? '✓' : '—'}</Descriptions.Item></Descriptions>; }
