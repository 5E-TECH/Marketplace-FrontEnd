import { Alert, App, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Check, ClipboardCheck, Eye, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useApproveSellerReturnMutation,
  useRejectSellerReturnMutation,
  useReturnQuery,
  useReviewSellerReturnMutation,
  useSellerReturnsQuery,
} from '../../features/returns/api/returnQueries';
import { getSellerReturnActions, RETURN_STATUSES } from '../../features/returns/lib/returnRules';
import type { ReturnRequest, ReturnRequestDetail, ReturnStatus } from '../../features/returns/model/returnTypes';
import { ReturnDecisionModal, type ReturnDecision } from '../../features/returns/ui/ReturnActionModals/ReturnActionModals';
import { returnMoney as money } from '../../features/returns/lib/returnMoney';
import { ReturnDetails } from '../../features/returns/ui/ReturnDetails/ReturnDetails';
import { ReturnStatusTag } from '../../features/returns/ui/ReturnStatusTag/ReturnStatusTag';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { TABLE_PAGE_SIZE } from '../../shared/config/pagination';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatDateTime } from '../../shared/lib/date';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { DetailDrawer } from '../../shared/ui/DetailDrawer/DetailDrawer';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterTabs } from '../../shared/ui/FilterTabs/FilterTabs';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './ReturnsPage.module.css';

type StatusFilter = 'ALL' | ReturnStatus;

/** Sotuvchi / operator: o'z do'koniga kelgan qaytarish so'rovlari. `?id=` — so'rovni to'g'ridan-to'g'ri ochadi. */
export default function ReturnsPage() {
  const { message } = App.useApp();
  const { locale, t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<ReturnDecision | null>(null);
  const selectedId = searchParams.get('id');
  const listQuery = useSellerReturnsQuery({ page, limit: TABLE_PAGE_SIZE, ...(status !== 'ALL' ? { status } : {}) });
  const detailQuery = useReturnQuery('seller', selectedId);
  const review = useReviewSellerReturnMutation();
  const approve = useApproveSellerReturnMutation();
  const reject = useRejectSellerReturnMutation();
  const pending = review.isPending || approve.isPending || reject.isPending;

  const openReturn = (id: string) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set('id', id); return next; });
  const closeReturn = () => {
    if (pending) return;
    setDecision(null);
    setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('id'); return next; }, { replace: true });
  };

  const submitDecision = async (text: string) => {
    if (!selectedId || !decision) return;
    try {
      if (decision === 'review') await review.mutateAsync({ id: selectedId, ...(text ? { comment: text } : {}) });
      else if (decision === 'approve') await approve.mutateAsync({ id: selectedId, ...(text ? { comment: text } : {}) });
      else await reject.mutateAsync({ id: selectedId, reason: text });
      void message.success(t(decision === 'review' ? 'returns.reviewed' : decision === 'approve' ? 'returns.approved' : 'returns.rejected'));
      setDecision(null);
    } catch (error) {
      void message.error(getApiErrorMessage(error));
    }
  };

  const renderActions = (value: ReturnRequestDetail) => {
    const actions = getSellerReturnActions(value.status);
    if (!actions.review && !actions.approve && !actions.reject) {
      return value.status === 'APPROVED' || value.status === 'REJECTED' ? <Alert className={styles.notice} type="info" showIcon title={t('returns.decided')} /> : null;
    }
    return <>
      {actions.review ? <Button icon={<ClipboardCheck size={16} />} onClick={() => setDecision('review')}>{t('returns.review')}</Button> : null}
      {actions.approve ? <Button type="primary" icon={<Check size={16} />} onClick={() => setDecision('approve')}>{t('returns.approve')}</Button> : null}
      {actions.reject ? <Button danger icon={<X size={16} />} onClick={() => setDecision('reject')}>{t('returns.reject')}</Button> : null}
    </>;
  };

  const columns: ColumnsType<ReturnRequest> = [
    { title: t('returns.request'), render: (_, value) => <span className={styles.idCell}><strong>#{value.id}</strong><small>{formatDateTime(value.createdAt, locale)}</small></span> },
    { title: t('returns.order'), dataIndex: 'orderId', responsive: ['sm'], render: (orderId: string) => `#${orderId}` },
    { title: t('returns.products'), responsive: ['md'], render: (_, value) => <span className={styles.products}>{value.items[0]?.productName ?? '—'}{value.items.length > 1 ? <small>{t('returns.moreItems', { count: value.items.length - 1 })}</small> : null}</span> },
    { title: t('returns.amount'), dataIndex: 'requestedAmount', responsive: ['sm'], render: (amount: number) => <span className={styles.amount}>{money(amount)}</span> },
    { title: t('returns.reasonLabel'), dataIndex: 'reason', responsive: ['lg'], render: (reason: ReturnRequest['reason']) => t(`returns.reason.${reason}`) },
    { title: t('returns.statusLabel'), dataIndex: 'status', render: (value: ReturnStatus) => <ReturnStatusTag status={value} /> },
    { title: '', width: 56, align: 'center', render: (_, value) => <Button type="text" icon={<Eye size={17} />} aria-label={t('returns.view', { id: value.id })} onClick={() => openReturn(value.id)} /> },
  ];
  const detail = detailQuery.data;
  const hint = decision === 'review' ? t('returns.reviewHint') : decision === 'approve' ? t('returns.approveHint') : t('returns.rejectHint');

  return <main className={styles.page}>
    <PageHeader title={t('returns.title')} description={t('returns.description')} />
    <div className={styles.filters}>
      <FilterTabs<StatusFilter> value={status} ariaLabel={t('returns.statusLabel')} options={[{ value: 'ALL', label: t('returns.status.all') }, ...RETURN_STATUSES.map((value) => ({ value, label: t(`returns.status.${value}`) }))]} onChange={(value) => { setStatus(value); setPage(1); }} />
    </div>
    {listQuery.isError ? <ContentState state="error" title={t('returns.loadError')} description={getApiErrorMessage(listQuery.error)} onAction={() => void listQuery.refetch()} />
      : !listQuery.data ? <ContentState state="loading" />
      : <TablePanel title={t('returns.list')} caption={t('pagination.total', { total: listQuery.data.total })}>
        <DataTable<ReturnRequest> loading={listQuery.isFetching} rowKey="id" columns={columns} dataSource={listQuery.data.items} tableLayout="auto" emptyState={<EmptyState compact title={t('returns.empty')} description={t('returns.emptyDescription')} />} pagination={{ current: page, total: listQuery.data.total, onChange: setPage }} />
      </TablePanel>}
    <DetailDrawer open={Boolean(selectedId)} title={t('returns.detailTitle', { id: selectedId ?? '' })} size="min(560px, 100vw)" onClose={closeReturn}>
      {detailQuery.isError ? <ContentState state="error" title={t('returns.detailError')} description={getApiErrorMessage(detailQuery.error)} onAction={() => void detailQuery.refetch()} />
        : !detail ? <ContentState state="loading" />
        : <ReturnDetails value={detail} scope="seller" actions={renderActions(detail)} />}
    </DetailDrawer>
    <ReturnDecisionModal decision={decision} hint={hint} loading={pending} onSubmit={submitDecision} onCancel={() => { if (!pending) setDecision(null); }} />
  </main>;
}
