import { App, Button, Space, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Check, CirclePause } from 'lucide-react';
import { useState } from 'react';
import { useAdminPayoutsQuery, useFinanceReportQuery, usePayoutActionMutation } from '../../features/adminFinance/api/adminFinanceQueries';
import type { AdminPayout, PayoutAction, PayoutStatus, ReportParams } from '../../features/adminFinance/model/adminFinanceTypes';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { formatDateTime } from '../../shared/lib/date';
import { flattenPrimitiveEntries } from '../../shared/lib/primitiveEntries';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { TABLE_PAGE_SIZE } from '../../shared/config/pagination';
import { ResetFiltersButton } from '../../shared/ui/ResetFiltersButton/ResetFiltersButton';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import { DateRangeFilter } from '../../shared/ui/DateRangeFilter/DateRangeFilter';
import { SearchInput } from '../../shared/ui/SearchInput/SearchInput';
import { FilterSelect } from '../../shared/ui/FilterPanel/FilterSelect';
import styles from './AdminFinancePage.module.css';

type FinanceTab = 'payouts' | 'reports' | 'reconciliation';
type StatusFilter = 'ALL' | PayoutStatus;
const payoutStatuses: PayoutStatus[] = ['PENDING', 'APPROVED', 'HELD', 'PAID'];

export default function AdminFinancePage() {
  const { message } = App.useApp(); const { locale, t } = useTranslation(); const [tab, setTab] = useState<FinanceTab>('payouts'); const [shopId, setShopId] = useState(''); const [status, setStatus] = useState<StatusFilter>('ALL'); const [page, setPage] = useState(1); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const reportParams: ReportParams = { ...(shopId ? { shopId } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
  const payouts = useAdminPayoutsQuery({ page, limit: TABLE_PAGE_SIZE, ...(shopId ? { shopId } : {}), ...(status !== 'ALL' ? { status } : {}) }, tab === 'payouts');
  const reports = useFinanceReportQuery('reports', reportParams, tab === 'reports'); const reconciliation = useFinanceReportQuery('reconciliation', reportParams, tab === 'reconciliation'); const mutation = usePayoutActionMutation();
  const runAction = (row: AdminPayout, action: PayoutAction) => mutation.mutate({ id: row.id, action }, { onSuccess: () => void message.success(t('admin.finance.updated')), onError: error => void message.error(getApiErrorMessage(error)) });
  const columns: ColumnsType<AdminPayout> = [
    { title: t('admin.finance.payout'), render: (_, row) => `#${row.id}` }, { title: t('admin.common.shop'), render: (_, row) => row.shopName || (row.shopId ? `#${row.shopId}` : '—') }, { title: t('admin.common.amount'), dataIndex: 'amount', render: (value: number) => `${formatMoney(value)} UZS` }, { title: t('common.status'), dataIndex: 'status', width: 120, render: (value: PayoutStatus) => <StatusTag status={value} /> }, { title: t('common.createdAt'), dataIndex: 'createdAt', responsive: ['lg'], render: (value: string) => value ? formatDateTime(value, locale) : '—' },
    { title: t('common.actions'), width: 180, render: (_, row) => <Space wrap>{row.status === 'PENDING' ? <Button size="small" type="primary" icon={<Check size={15} />} loading={mutation.isPending} onClick={() => runAction(row, 'approve')}>{t('admin.finance.approve')}</Button> : null}{row.status !== 'HELD' && row.status !== 'PAID' ? <Button size="small" icon={<CirclePause size={15} />} loading={mutation.isPending} onClick={() => runAction(row, 'hold')}>{t('admin.finance.hold')}</Button> : null}{row.status === 'HELD' ? <Button size="small" type="primary" icon={<Check size={15} />} loading={mutation.isPending} onClick={() => runAction(row, 'release')}>{t('admin.finance.release')}</Button> : null}</Space> },
  ];
  const activeReport = tab === 'reports' ? reports : reconciliation;
  return <main><PageHeader title={t('admin.finance.title')} description={t('admin.finance.description')} /><Tabs activeKey={tab} onChange={value => setTab(value as FinanceTab)} items={[{ key: 'payouts', label: t('admin.finance.payouts') }, { key: 'reports', label: t('admin.finance.report') }, { key: 'reconciliation', label: t('admin.finance.reconciliation') }]} />
    <FilterPanel className={styles.toolbar} aria-label={t('admin.common.filters')}><SearchInput value={shopId} inputMode="numeric" placeholder={t('admin.finance.shopId')} aria-label={t('admin.finance.shopId')} onValueChange={value => { setShopId(value.replace(/\D/g, '')); setPage(1); }} />{tab === 'payouts' ? <FilterSelect<StatusFilter> value={status} aria-label={t('admin.finance.payoutStatus')} options={[{ value: 'ALL', label: t('admin.finance.allStatuses') }, ...payoutStatuses.map(value => ({ value, label: value }))]} onChange={value => { setStatus(value); setPage(1); }} /> : <DateRangeFilter value={[dateFrom, dateTo]} startLabel={t('admin.finance.dateFrom')} endLabel={t('admin.finance.dateTo')} onChange={([from, to]) => { setDateFrom(from); setDateTo(to); }} />}<ResetFiltersButton disabled={!shopId && status === 'ALL' && !dateFrom && !dateTo} onClick={() => { setShopId(''); setStatus('ALL'); setDateFrom(''); setDateTo(''); setPage(1); }} /></FilterPanel>
    {tab === 'payouts' ? payouts.isPending ? <ContentState state="loading" /> : payouts.isError ? <ContentState state="error" description={getApiErrorMessage(payouts.error)} onAction={() => void payouts.refetch()} /> : <TablePanel title={t('admin.finance.payouts')} caption={t('pagination.total', { total: payouts.data.total })}><DataTable rowKey="id" columns={columns} dataSource={payouts.data.items} emptyState={<EmptyState compact title={t('admin.finance.empty')} description={t('admin.finance.emptyDescription')} />} pagination={{ current: page, total: payouts.data.total, onChange: setPage }} /></TablePanel> : activeReport.isPending ? <ContentState state="loading" /> : activeReport.isError ? <ContentState state="error" description={getApiErrorMessage(activeReport.error)} onAction={() => void activeReport.refetch()} /> : <ReportView value={activeReport.data} />}
  </main>;
}

function ReportView({ value }: { value: unknown }) {
  const { t } = useTranslation();
  if (!value || typeof value !== 'object') return <EmptyState compact title={t('admin.finance.emptyReport')} description={t('admin.finance.emptyReportDescription')} />;
  const rows = flattenPrimitiveEntries(value);
  if (!rows.length) return <EmptyState compact title={t('admin.finance.emptyReport')} description={t('admin.finance.emptyReportDescription')} />;
  return <section className={styles.report}>{rows.map(([label, content]) => <article className={styles.metric} key={label}><span>{label}</span><strong>{typeof content === 'number' ? formatMoney(content) : String(content)}</strong></article>)}</section>;
}
