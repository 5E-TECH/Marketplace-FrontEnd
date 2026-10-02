import { Alert, Button, Input, Modal, Segmented, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminShipmentsQuery, useAdminWebhooksQuery } from '../../features/adminDelivery/api/adminDeliveryQueries';
import { sellerOrderStatuses, type AdminShipment, type AdminShipmentState, type AdminWebhookEvent, type SellerOrderStatus } from '../../features/adminDelivery/model/adminDeliveryTypes';
import { ReprovisionShopButton } from '../../features/adminDelivery/ui/ReprovisionShopButton';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime, toApiDateRange } from '../../shared/lib/date';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { DateRangeFilter } from '../../shared/ui/DateRangeFilter/DateRangeFilter';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterField } from '../../shared/ui/FilterPanel/FilterField';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { FilterSelect } from '../../shared/ui/FilterPanel/FilterSelect';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag, type AppStatus } from '../../shared/ui/StatusTag/StatusTag';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './AdminDeliveryPage.module.css';

const PAGE_SIZE = 20;
type DeliveryTab = 'shipments' | 'webhooks';
type StatusFilter = 'ALL' | SellerOrderStatus;

/** Sub-buyurtma va buyurtma holatlari — StatusTag biladiganlari. */
const KNOWN_STATUSES = new Set<string>([...sellerOrderStatuses, 'DRAFT', 'PENDING_PAYMENT', 'PAID', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REFUNDED']);
const digitsOnly = (value: string) => value.replace(/\D/g, '');

function AnyStatus({ status }: { status: string | null }) {
  if (!status) return <>—</>;
  return KNOWN_STATUSES.has(status) ? <StatusTag status={status as AppStatus} /> : <Tag bordered={false}>{status}</Tag>;
}

function useStatusOptions() {
  const { t } = useTranslation();
  return [{ value: 'ALL' as const, label: t('adminOps.delivery.allStatuses') }, ...sellerOrderStatuses.map((value) => ({ value, label: value.replaceAll('_', ' ') }))];
}

function ShipmentsTab() {
  const { locale, t } = useTranslation();
  const navigate = useNavigate();
  const statusOptions = useStatusOptions();
  const [shipmentState, setShipmentState] = useState<AdminShipmentState>('all');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [shopId, setShopId] = useState('');
  const [shipmentId, setShipmentId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const debouncedShopId = useDebouncedValue(shopId);
  const debouncedShipmentId = useDebouncedValue(shipmentId);
  const query = useAdminShipmentsQuery({
    page,
    limit: PAGE_SIZE,
    shipmentState,
    ...(status !== 'ALL' ? { status } : {}),
    ...(debouncedShopId ? { shopId: debouncedShopId } : {}),
    ...(debouncedShipmentId ? { shipmentId: debouncedShipmentId } : {}),
    ...toApiDateRange(dateFrom, dateTo),
  });
  // "Topshirilmagan" soni har doim ko‘rinsin — admin qotib qolganini darhol sezsin.
  const missing = useAdminShipmentsQuery({ page: 1, limit: 1, shipmentState: 'missing' });
  const missingCount = missing.data?.total;
  const hasFilters = Boolean(shopId || shipmentId || dateFrom || dateTo || status !== 'ALL');
  const clear = () => { setStatus('ALL'); setShopId(''); setShipmentId(''); setDateFrom(''); setDateTo(''); setPage(1); };

  const columns: ColumnsType<AdminShipment> = [
    {
      title: t('adminOps.delivery.order'),
      render: (_, row) => (
        <span className={styles.order}>
          <Button type="link" className={styles.orderLink} aria-label={t('adminOps.delivery.openOrder', { id: row.salesOrderId })} onClick={() => void navigate(`/admin/orders/${encodeURIComponent(row.salesOrderId)}`)}>#{row.salesOrderId}</Button>
          <small>{row.buyerName || '—'} · {t('adminOps.delivery.sellerOrderId')} #{row.id}</small>
        </span>
      ),
    },
    { title: t('adminOps.shop'), dataIndex: 'shopId', width: 90, render: (value: string) => `#${value}` },
    { title: t('adminOps.delivery.status'), dataIndex: 'status', render: (value: string) => <AnyStatus status={value} /> },
    { title: t('adminOps.delivery.orderStatus'), dataIndex: 'orderStatus', responsive: ['md'], render: (value: string | null) => <AnyStatus status={value} /> },
    {
      title: t('adminOps.delivery.shipment'),
      render: (_, row) => row.shipmentId ? (
        <span className={styles.shipment}>
          <span className={styles.number}>#{row.shipmentId}</span>
          {row.trackingUrl && /^https?:\/\//i.test(row.trackingUrl) ? <a href={row.trackingUrl} target="_blank" rel="noreferrer">{t('adminOps.delivery.tracking')}</a> : null}
        </span>
      ) : <Tag color="error" bordered={false}>{t('adminOps.delivery.noShipment')}</Tag>,
    },
    { title: t('adminOps.delivery.cod'), dataIndex: 'codAmount', align: 'right', responsive: ['sm'], render: (value: number) => <span className={styles.number}>{formatMoney(value)} UZS</span> },
    { title: t('adminOps.delivery.updatedAt'), dataIndex: 'updatedAt', responsive: ['xl'], render: (value: string) => value ? formatDateTime(value, locale) : '—' },
    { title: '', width: 56, align: 'center', render: (_, row) => row.shipmentId ? null : <ReprovisionShopButton shopId={row.shopId} compact /> },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.stateBar}>
        <Segmented<AdminShipmentState>
          aria-label={t('adminOps.delivery.shipmentState')}
          value={shipmentState}
          onChange={(value) => { setShipmentState(value); setPage(1); }}
          options={[
            { value: 'all', label: t('adminOps.delivery.state.all') },
            { value: 'created', label: t('adminOps.delivery.state.created') },
            { value: 'missing', label: missingCount ? `${t('adminOps.delivery.state.missing')} (${missingCount})` : t('adminOps.delivery.state.missing') },
          ]}
        />
      </div>
      {shipmentState === 'missing' ? <Alert type="warning" showIcon title={t('adminOps.delivery.missingHint')} /> : null}
      <FilterPanel className={styles.filters} aria-label={t('admin.common.filters')}>
        <FilterField label={t('adminOps.delivery.status')} htmlFor="admin-shipment-status">
          <FilterSelect<StatusFilter> id="admin-shipment-status" value={status} options={statusOptions} onChange={(value) => { setStatus(value); setPage(1); }} />
        </FilterField>
        <FilterField label={t('adminOps.shopId')} htmlFor="admin-shipment-shop">
          <Input id="admin-shipment-shop" value={shopId} inputMode="numeric" allowClear placeholder="15" onChange={(event) => { setShopId(digitsOnly(event.target.value)); setPage(1); }} />
        </FilterField>
        <FilterField label={t('adminOps.delivery.shipmentId')} htmlFor="admin-shipment-id">
          <Input id="admin-shipment-id" value={shipmentId} inputMode="numeric" allowClear placeholder="1251131" onChange={(event) => { setShipmentId(digitsOnly(event.target.value)); setPage(1); }} />
        </FilterField>
        <DateRangeFilter className={styles.dateRange} value={[dateFrom, dateTo]} startLabel={t('adminOps.delivery.dateFrom')} endLabel={t('adminOps.delivery.dateTo')} onChange={([from, to]) => { setDateFrom(from); setDateTo(to); setPage(1); }} />
        <div className={styles.clear}><Button icon={<RotateCcw size={16} />} disabled={!hasFilters} onClick={clear}>{t('adminOps.clear')}</Button></div>
      </FilterPanel>
      {query.isPending ? <ContentState state="loading" /> : query.isError ? (
        <ContentState state="error" title={t('adminOps.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />
      ) : (
        <TablePanel title={t('adminOps.delivery.shipmentsTab')} caption={t('pagination.total', { total: query.data.total })}>
          <DataTable
            rowKey="id"
            loading={query.isFetching}
            columns={columns}
            dataSource={query.data.items}
            tableLayout="auto"
            scroll={{ x: 'max-content' }}
            emptyState={<EmptyState compact title={shipmentState === 'missing' ? t('adminOps.delivery.emptyMissing') : t('adminOps.delivery.emptyShipments')} />}
            pagination={{ ...createTablePagination(PAGE_SIZE, (total) => t('pagination.total', { total })), current: page, total: query.data.total }}
            onChange={(pagination) => setPage(pagination.current ?? 1)}
          />
        </TablePanel>
      )}
    </div>
  );
}

function WebhooksTab() {
  const { locale, t } = useTranslation();
  const statusOptions = useStatusOptions();
  const [eventId, setEventId] = useState('');
  const [shipmentId, setShipmentId] = useState('');
  const [sellerOrderId, setSellerOrderId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<AdminWebhookEvent | null>(null);
  const debouncedEventId = useDebouncedValue(eventId.trim());
  const debouncedShipmentId = useDebouncedValue(shipmentId);
  const debouncedSellerOrderId = useDebouncedValue(sellerOrderId);
  const query = useAdminWebhooksQuery({
    page,
    limit: PAGE_SIZE,
    ...(debouncedEventId ? { eventId: debouncedEventId } : {}),
    ...(debouncedShipmentId ? { shipmentId: debouncedShipmentId } : {}),
    ...(debouncedSellerOrderId ? { sellerOrderId: debouncedSellerOrderId } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...toApiDateRange(dateFrom, dateTo),
  });
  const hasFilters = Boolean(eventId || shipmentId || sellerOrderId || dateFrom || dateTo || status !== 'ALL');
  const clear = () => { setEventId(''); setShipmentId(''); setSellerOrderId(''); setStatus('ALL'); setDateFrom(''); setDateTo(''); setPage(1); };

  const columns: ColumnsType<AdminWebhookEvent> = [
    { title: t('adminOps.delivery.processedAt'), dataIndex: 'processedAt', width: 170, render: (value: string | null) => value ? formatDateTime(value, locale) : '—' },
    { title: t('adminOps.delivery.eventId'), dataIndex: 'eventId', render: (value: string) => <span className={styles.number}>{value}</span> },
    { title: t('adminOps.delivery.shipmentId'), dataIndex: 'shipmentId', responsive: ['sm'], render: (value: string | null) => value ? `#${value}` : '—' },
    { title: t('adminOps.delivery.sellerOrderId'), dataIndex: 'sellerOrderId', responsive: ['md'], render: (value: string | null) => value ? `#${value}` : '—' },
    { title: t('adminOps.delivery.status'), dataIndex: 'status', render: (value: string) => <AnyStatus status={value} /> },
    { title: t('adminOps.delivery.payload'), width: 100, align: 'center', render: (_, row) => <Button type="link" onClick={() => setOpened(row)}>{t('adminOps.delivery.viewPayload')}</Button> },
  ];

  return (
    <div className={styles.page}>
      <FilterPanel className={styles.webhookFilters} aria-label={t('admin.common.filters')}>
        <FilterField label={t('adminOps.delivery.eventId')} htmlFor="admin-webhook-event">
          <Input id="admin-webhook-event" value={eventId} allowClear maxLength={128} onChange={(event) => { setEventId(event.target.value); setPage(1); }} />
        </FilterField>
        <FilterField label={t('adminOps.delivery.shipmentId')} htmlFor="admin-webhook-shipment">
          <Input id="admin-webhook-shipment" value={shipmentId} inputMode="numeric" allowClear onChange={(event) => { setShipmentId(digitsOnly(event.target.value)); setPage(1); }} />
        </FilterField>
        <FilterField label={t('adminOps.delivery.sellerOrderId')} htmlFor="admin-webhook-seller-order">
          <Input id="admin-webhook-seller-order" value={sellerOrderId} inputMode="numeric" allowClear onChange={(event) => { setSellerOrderId(digitsOnly(event.target.value)); setPage(1); }} />
        </FilterField>
        <FilterField label={t('adminOps.delivery.status')} htmlFor="admin-webhook-status">
          <FilterSelect<StatusFilter> id="admin-webhook-status" value={status} options={statusOptions} onChange={(value) => { setStatus(value); setPage(1); }} />
        </FilterField>
        <DateRangeFilter className={styles.dateRange} value={[dateFrom, dateTo]} startLabel={t('adminOps.delivery.dateFrom')} endLabel={t('adminOps.delivery.dateTo')} onChange={([from, to]) => { setDateFrom(from); setDateTo(to); setPage(1); }} />
        <div className={styles.clear}><Button icon={<RotateCcw size={16} />} disabled={!hasFilters} onClick={clear}>{t('adminOps.clear')}</Button></div>
      </FilterPanel>
      {query.isPending ? <ContentState state="loading" /> : query.isError ? (
        <ContentState state="error" title={t('adminOps.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />
      ) : (
        <TablePanel title={t('adminOps.delivery.webhooksTab')} caption={t('pagination.total', { total: query.data.total })}>
          <DataTable
            rowKey="eventId"
            loading={query.isFetching}
            columns={columns}
            dataSource={query.data.items}
            tableLayout="auto"
            scroll={{ x: 'max-content' }}
            emptyState={<EmptyState compact title={t('adminOps.delivery.emptyWebhooks')} />}
            pagination={{ ...createTablePagination(PAGE_SIZE, (total) => t('pagination.total', { total })), current: page, total: query.data.total }}
            onChange={(pagination) => setPage(pagination.current ?? 1)}
          />
        </TablePanel>
      )}
      <Modal title={t('adminOps.delivery.payloadTitle', { id: opened?.eventId ?? '' })} open={Boolean(opened)} footer={null} onCancel={() => setOpened(null)} width="min(720px, 100vw)" destroyOnHidden>
        <pre className={styles.payload}>{JSON.stringify(opened?.payload ?? null, null, 2)}</pre>
      </Modal>
    </div>
  );
}

/** C6.7 — Elchi posilkalari, topshirilmay qolgan buyurtmalar va webhook tarixi. */
export default function AdminDeliveryPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: DeliveryTab = searchParams.get('tab') === 'webhooks' ? 'webhooks' : 'shipments';
  return (
    <main className={styles.page}>
      <PageHeader title={t('adminOps.delivery.title')} description={t('adminOps.delivery.description')} />
      <Tabs
        activeKey={tab}
        destroyOnHidden
        onChange={(key) => setSearchParams(key === 'shipments' ? {} : { tab: key }, { replace: true })}
        items={[
          { key: 'shipments', label: t('adminOps.delivery.shipmentsTab'), children: <ShipmentsTab /> },
          { key: 'webhooks', label: t('adminOps.delivery.webhooksTab'), children: <WebhooksTab /> },
        ]}
      />
    </main>
  );
}
