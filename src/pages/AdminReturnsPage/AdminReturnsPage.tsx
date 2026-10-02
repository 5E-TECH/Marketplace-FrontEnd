import { Alert, App, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Banknote, Check, Eye, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { useAdminShopsQuery } from '../../features/adminShops/api/adminShopQueries';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import {
  useAdminReturnsQuery,
  useApproveAdminReturnMutation,
  useRefundAdminReturnMutation,
  useRejectAdminReturnMutation,
  useReturnQuery,
} from '../../features/returns/api/returnQueries';
import { getAdminReturnActions, RETURN_STATUSES } from '../../features/returns/lib/returnRules';
import type { ReturnRequest, ReturnRequestDetail, ReturnStatus } from '../../features/returns/model/returnTypes';
import { ReturnDecisionModal, ReturnRefundModal, type RefundSubmit } from '../../features/returns/ui/ReturnActionModals/ReturnActionModals';
import { returnMoney as money } from '../../features/returns/lib/returnMoney';
import { ReturnDetails } from '../../features/returns/ui/ReturnDetails/ReturnDetails';
import { ReturnStatusTag } from '../../features/returns/ui/ReturnStatusTag/ReturnStatusTag';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { TABLE_PAGE_SIZE } from '../../shared/config/pagination';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatDateTime } from '../../shared/lib/date';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { DateRangeFilter } from '../../shared/ui/DateRangeFilter/DateRangeFilter';
import { DetailDrawer } from '../../shared/ui/DetailDrawer/DetailDrawer';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterField } from '../../shared/ui/FilterPanel/FilterField';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { FilterSelect } from '../../shared/ui/FilterPanel/FilterSelect';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { ResetFiltersButton } from '../../shared/ui/ResetFiltersButton/ResetFiltersButton';
import { SearchInput } from '../../shared/ui/SearchInput/SearchInput';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './AdminReturnsPage.module.css';

type StatusFilter = 'ALL' | ReturnStatus;
type AdminDecision = 'approve' | 'reject';
interface ShopOption { id: string; name: string }

/**
 * Admin: barcha do'konlar bo'yicha qaytarishlar. Qarorni o'zgartira oladi (nizo),
 * pulni faqat SUPERADMIN qaytaradi. `?id=` — so'rovni ochadi, `?orderId=` — buyurtma bo'yicha filtr.
 */
export default function AdminReturnsPage() {
  const { message } = App.useApp();
  const { locale, t } = useTranslation();
  const role = useAppSelector(selectAuthUser)?.role;
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [shop, setShop] = useState<ShopOption | null>(null);
  const [shopSearch, setShopSearch] = useState('');
  const [orderId, setOrderId] = useState(() => (searchParams.get('orderId') ?? '').replace(/\D/g, ''));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<AdminDecision | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const debouncedOrderId = useDebouncedValue(orderId);
  const debouncedShopSearch = useDebouncedValue(shopSearch.trim());
  const selectedId = searchParams.get('id');
  const shopsQuery = useAdminShopsQuery({ page: 1, limit: 20, ...(debouncedShopSearch ? { search: debouncedShopSearch } : {}) });
  const listQuery = useAdminReturnsQuery({
    page,
    limit: TABLE_PAGE_SIZE,
    ...(status !== 'ALL' ? { status } : {}),
    ...(shop ? { shopId: shop.id } : {}),
    ...(debouncedOrderId ? { orderId: debouncedOrderId } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  });
  const detailQuery = useReturnQuery('admin', selectedId);
  const approve = useApproveAdminReturnMutation();
  const reject = useRejectAdminReturnMutation();
  const refund = useRefundAdminReturnMutation();
  const pending = approve.isPending || reject.isPending || refund.isPending;

  const shopOptions: ShopOption[] = shopsQuery.data?.items.map(({ id, name }) => ({ id, name })) ?? [];
  if (shop && !shopOptions.some(({ id }) => id === shop.id)) shopOptions.unshift(shop);
  const hasFilters = status !== 'ALL' || Boolean(shop || orderId || dateFrom || dateTo);
  // `?orderId=` URL bilan bir xil turadi: tozalangandan keyin sahifa yangilansa eski filtr qaytmaydi.
  const changeOrderId = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setOrderId(digits);
    setPage(1);
    setSearchParams((current) => { const next = new URLSearchParams(current); if (digits) next.set('orderId', digits); else next.delete('orderId'); return next; }, { replace: true });
  };
  const reset = () => { setStatus('ALL'); setShop(null); changeOrderId(''); setDateFrom(''); setDateTo(''); };

  const openReturn = (id: string) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set('id', id); return next; });
  const closeReturn = () => {
    if (pending) return;
    setDecision(null);
    setRefundOpen(false);
    setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('id'); return next; }, { replace: true });
  };

  const submitDecision = async (text: string) => {
    if (!selectedId || !decision) return;
    try {
      if (decision === 'approve') await approve.mutateAsync({ id: selectedId, ...(text ? { comment: text } : {}) });
      else await reject.mutateAsync({ id: selectedId, reason: text });
      void message.success(t(decision === 'approve' ? 'returns.approved' : 'returns.rejected'));
      setDecision(null);
    } catch (error) {
      void message.error(getApiErrorMessage(error));
    }
  };

  const submitRefund = async ({ amount, restock, comment }: RefundSubmit) => {
    if (!selectedId) return;
    try {
      const result = await refund.mutateAsync({ id: selectedId, amount, restock, ...(comment ? { comment } : {}) });
      void message.success(t('returns.refunded', { amount: money(result.refundedAmount ?? amount) }));
      setRefundOpen(false);
    } catch (error) {
      void message.error(getApiErrorMessage(error));
    }
  };

  const renderActions = (value: ReturnRequestDetail) => {
    const actions = getAdminReturnActions(value.status, role);
    // Tasdiqlangan so'rovda ADMIN pul qaytara olmaydi — kim qaytarishi aytiladi.
    const refundNote = value.status === 'APPROVED' && !actions.refund ? <Alert className={styles.notice} type="info" showIcon title={t('returns.refundBySuperadmin')} /> : null;
    if (!actions.approve && !actions.reject && !actions.refund) return refundNote;
    return <>
      {refundNote}
      {actions.approve ? <Button type="primary" icon={<Check size={16} />} onClick={() => setDecision('approve')}>{t('returns.approve')}</Button> : null}
      {actions.refund ? <Button type="primary" icon={<Banknote size={16} />} onClick={() => setRefundOpen(true)}>{t('returns.refund')}</Button> : null}
      {actions.reject ? <Button danger icon={<X size={16} />} onClick={() => setDecision('reject')}>{t('returns.reject')}</Button> : null}
    </>;
  };

  const columns: ColumnsType<ReturnRequest> = [
    { title: t('returns.request'), render: (_, value) => <span className={styles.idCell}><strong>#{value.id}</strong><small>{formatDateTime(value.createdAt, locale)}</small></span> },
    { title: t('returns.order'), dataIndex: 'orderId', responsive: ['sm'], render: (id: string) => <Link to={`/admin/orders/${encodeURIComponent(id)}`}>#{id}</Link> },
    { title: t('returns.shop'), responsive: ['lg'], render: (_, value) => value.shopName ?? `#${value.shopId}` },
    { title: t('returns.buyer'), dataIndex: 'buyerName', responsive: ['xl'], render: (name: string | null) => name ?? '—' },
    { title: t('returns.amount'), dataIndex: 'requestedAmount', responsive: ['sm'], render: (amount: number) => <span className={styles.amount}>{money(amount)}</span> },
    { title: t('returns.payment'), dataIndex: 'paymentMethod', responsive: ['md'], width: 90, render: (method: string) => method.toUpperCase() },
    { title: t('returns.statusLabel'), dataIndex: 'status', render: (value: ReturnStatus) => <ReturnStatusTag status={value} /> },
    { title: '', width: 56, align: 'center', render: (_, value) => <Button type="text" icon={<Eye size={17} />} aria-label={t('returns.view', { id: value.id })} onClick={() => openReturn(value.id)} /> },
  ];
  const detail = detailQuery.data;

  return <main className={styles.page}>
    <PageHeader title={t('returns.title')} description={t('returns.adminDescription')} />
    <FilterPanel className={styles.filterPanel} aria-label={t('returns.filters')}>
      <FilterField label={t('returns.statusLabel')} htmlFor="admin-return-status">
        <FilterSelect<StatusFilter> id="admin-return-status" value={status} options={[{ value: 'ALL', label: t('returns.allStatuses') }, ...RETURN_STATUSES.map((value) => ({ value, label: t(`returns.status.${value}`) }))]} onChange={(value) => { setStatus(value); setPage(1); }} />
      </FilterField>
      <FilterField label={t('returns.shop')} htmlFor="admin-return-shop">
        <FilterSelect<string>
          id="admin-return-shop"
          allowClear
          value={shop?.id}
          placeholder={t('returns.allShops')}
          options={shopOptions.map(({ id, name }) => ({ value: id, label: name }))}
          showSearch={{ onSearch: setShopSearch, filterOption: false }}
          loading={shopsQuery.isFetching}
          onChange={(id) => { setShop(shopOptions.find((option) => option.id === id) ?? null); setShopSearch(''); setPage(1); }}
        />
      </FilterField>
      <FilterField label={t('returns.orderId')} htmlFor="admin-return-order">
        <SearchInput id="admin-return-order" inputMode="numeric" value={orderId} placeholder={t('returns.orderIdPlaceholder')} onValueChange={changeOrderId} />
      </FilterField>
      <DateRangeFilter className={styles.dateRange} value={[dateFrom, dateTo]} startLabel={t('returns.dateFrom')} endLabel={t('returns.dateTo')} onChange={([from, to]) => { setDateFrom(from); setDateTo(to); setPage(1); }} />
      <div className={styles.filterAction}><ResetFiltersButton disabled={!hasFilters} onClick={reset} /></div>
    </FilterPanel>
    {listQuery.isError ? <ContentState state="error" title={t('returns.loadError')} description={getApiErrorMessage(listQuery.error)} onAction={() => void listQuery.refetch()} />
      : !listQuery.data ? <ContentState state="loading" />
      : <TablePanel title={t('returns.list')} caption={t('pagination.total', { total: listQuery.data.total })}>
        <DataTable<ReturnRequest> loading={listQuery.isFetching} rowKey="id" columns={columns} dataSource={listQuery.data.items} tableLayout="auto" emptyState={<EmptyState compact title={t('returns.empty')} description={t('returns.emptyDescription')} />} pagination={{ current: page, total: listQuery.data.total, onChange: setPage }} />
      </TablePanel>}
    <DetailDrawer open={Boolean(selectedId)} title={t('returns.detailTitle', { id: selectedId ?? '' })} size="min(560px, 100vw)" onClose={closeReturn}>
      {detailQuery.isError ? <ContentState state="error" title={t('returns.detailError')} description={getApiErrorMessage(detailQuery.error)} onAction={() => void detailQuery.refetch()} />
        : !detail ? <ContentState state="loading" />
        : <ReturnDetails value={detail} scope="admin" actions={renderActions(detail)} />}
    </DetailDrawer>
    <ReturnDecisionModal decision={decision} hint={decision === 'approve' ? t('returns.approveHintAdmin') : t('returns.rejectHint')} loading={pending} onSubmit={submitDecision} onCancel={() => { if (!pending) setDecision(null); }} />
    <ReturnRefundModal value={refundOpen ? detail ?? null : null} loading={refund.isPending} onSubmit={submitRefund} onCancel={() => { if (!refund.isPending) setRefundOpen(false); }} />
  </main>;
}
