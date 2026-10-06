import { App, Button, Space, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Check, CirclePause } from 'lucide-react';
import { useState } from 'react';
import { useAdminLedgerQuery, useAdminPayoutsQuery, useFinanceReconciliationQuery, usePayoutActionMutation } from '../../features/adminFinance/api/adminFinanceQueries';
import type { AdminPayout, PayoutAction, PayoutStatus, ReportParams } from '../../features/adminFinance/model/adminFinanceTypes';
import { useAdminShopNames } from '../../features/adminShops/api/adminShopQueries';
import { ENTRY_LABELS, PAYOUT_STATUSES, PAYOUT_STATUS_LABELS, REFERENCE_LABELS } from '../../features/sellerFinance/lib/financeLabels';
import type { CodReconciliation, LedgerEntry, LedgerEntryType } from '../../features/sellerFinance/model/sellerFinanceTypes';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { formatDateTime } from '../../shared/lib/date';
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

type FinanceTab = 'payouts' | 'ledger' | 'reconciliation';
type StatusFilter = 'ALL' | PayoutStatus;

export default function AdminFinancePage() {
  const { message } = App.useApp(); const { locale, t } = useTranslation(); const [tab, setTab] = useState<FinanceTab>('payouts'); const [shopId, setShopId] = useState(''); const [status, setStatus] = useState<StatusFilter>('ALL'); const [page, setPage] = useState(1); const [ledgerPage, setLedgerPage] = useState(1); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const reportParams: ReportParams = { ...(shopId ? { shopId } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
  const payouts = useAdminPayoutsQuery({ page, limit: TABLE_PAGE_SIZE, ...(shopId ? { shopId } : {}), ...(status !== 'ALL' ? { status } : {}) }, tab === 'payouts');
  const ledger = useAdminLedgerQuery({ page: ledgerPage, limit: TABLE_PAGE_SIZE, ...reportParams }, tab === 'ledger'); const reconciliation = useFinanceReconciliationQuery(reportParams, tab === 'reconciliation'); const mutation = usePayoutActionMutation();
  // DTO'da do'kon nomi yo'q — nomlar do'kon tafsilotidan (5 daqiqa keshlanadi), topilmasa `#id`.
  const shopNames = useAdminShopNames([...(payouts.data?.items ?? []), ...(ledger.data?.items ?? [])].map(row => row.shopId));
  const shopLabel = (id: string) => shopNames.get(id) ?? `#${id}`;
  const money = (value: number) => `${formatMoney(value)} UZS`;
  const runAction = (row: AdminPayout, action: PayoutAction) => mutation.mutate({ id: row.id, action }, { onSuccess: () => void message.success(t('admin.finance.updated')), onError: error => void message.error(getApiErrorMessage(error)) });
  const columns: ColumnsType<AdminPayout> = [
    { title: t('admin.finance.payout'), render: (_, row) => `#${row.id}` }, { title: t('admin.common.shop'), render: (_, row) => shopLabel(row.shopId) }, { title: t('sellerFinance.parcel'), dataIndex: 'referenceId', responsive: ['xl'], render: (value: string) => `#${value}` }, { title: t('admin.common.amount'), dataIndex: 'amount', render: (value: number) => money(value) }, { title: t('common.status'), dataIndex: 'status', width: 120, render: (value: PayoutStatus) => <StatusTag status={value} /> }, { title: t('common.createdAt'), dataIndex: 'createdAt', responsive: ['lg'], render: (value: string) => value ? formatDateTime(value, locale) : '—' }, { title: t('sellerFinance.paidAt'), dataIndex: 'paidAt', responsive: ['xl'], render: (value: string | null) => value ? formatDateTime(value, locale) : '—' },
    { title: t('common.actions'), width: 180, render: (_, row) => <Space wrap>{row.status === 'PENDING' ? <Button size="small" type="primary" icon={<Check size={15} />} loading={mutation.isPending} onClick={() => runAction(row, 'approve')}>{t('admin.finance.approve')}</Button> : null}{row.status !== 'HELD' && row.status !== 'PAID' ? <Button size="small" icon={<CirclePause size={15} />} loading={mutation.isPending} onClick={() => runAction(row, 'hold')}>{t('admin.finance.hold')}</Button> : null}{row.status === 'HELD' ? <Button size="small" type="primary" icon={<Check size={15} />} loading={mutation.isPending} onClick={() => runAction(row, 'release')}>{t('admin.finance.release')}</Button> : null}</Space> },
  ];
  const ledgerColumns: ColumnsType<LedgerEntry> = [
    { title: t('sellerFinance.date'), dataIndex: 'createdAt', render: (value: string) => formatDateTime(value, locale) }, { title: t('admin.common.shop'), render: (_, row) => shopLabel(row.shopId) }, { title: t('sellerFinance.entryType'), dataIndex: 'entryType', render: (value: LedgerEntryType) => <Tag>{t(ENTRY_LABELS[value])}</Tag> },
    { title: t('sellerFinance.reference'), responsive: ['lg'], render: (_, row) => { const label = REFERENCE_LABELS[row.referenceType]; return `${label ? t(label) : row.referenceType} #${row.referenceId}`; } },
    { title: t('admin.common.amount'), dataIndex: 'amount', align: 'right', render: (value: number) => <strong className={value < 0 ? styles.expense : styles.income}>{`${value > 0 ? '+' : ''}${money(value)}`}</strong> }, { title: t('sellerFinance.balanceAfter'), dataIndex: 'balanceAfter', align: 'right', responsive: ['md'], render: (value: number) => money(value) },
  ];
  const resetFilters = () => { setShopId(''); setStatus('ALL'); setDateFrom(''); setDateTo(''); setPage(1); setLedgerPage(1); };
  return <main><PageHeader title={t('admin.finance.title')} description={t('admin.finance.description')} /><Tabs activeKey={tab} onChange={value => setTab(value as FinanceTab)} items={[{ key: 'payouts', label: t('admin.finance.payouts') }, { key: 'ledger', label: t('admin.finance.ledger') }, { key: 'reconciliation', label: t('admin.finance.reconciliation') }]} />
    <FilterPanel className={styles.toolbar} aria-label={t('admin.common.filters')}><SearchInput value={shopId} inputMode="numeric" placeholder={t('admin.finance.shopId')} aria-label={t('admin.finance.shopId')} onValueChange={value => { setShopId(value.replace(/\D/g, '')); setPage(1); setLedgerPage(1); }} />{tab === 'payouts' ? <FilterSelect<StatusFilter> value={status} aria-label={t('admin.finance.payoutStatus')} options={[{ value: 'ALL', label: t('admin.finance.allStatuses') }, ...PAYOUT_STATUSES.map(value => ({ value, label: t(PAYOUT_STATUS_LABELS[value]) }))]} onChange={value => { setStatus(value); setPage(1); }} /> : <DateRangeFilter value={[dateFrom, dateTo]} startLabel={t('admin.finance.dateFrom')} endLabel={t('admin.finance.dateTo')} onChange={([from, to]) => { setDateFrom(from); setDateTo(to); setLedgerPage(1); }} />}<ResetFiltersButton disabled={!shopId && status === 'ALL' && !dateFrom && !dateTo} onClick={resetFilters} /></FilterPanel>
    {tab === 'payouts' ? payouts.isPending ? <ContentState state="loading" /> : payouts.isError ? <ContentState state="error" description={getApiErrorMessage(payouts.error)} onAction={() => void payouts.refetch()} /> : <TablePanel title={t('admin.finance.payouts')} caption={t('pagination.total', { total: payouts.data.total })}><DataTable rowKey="id" columns={columns} dataSource={payouts.data.items} emptyState={<EmptyState compact title={t('admin.finance.empty')} description={t('admin.finance.emptyDescription')} />} pagination={{ current: page, total: payouts.data.total, onChange: setPage }} /></TablePanel>
      : tab === 'ledger' ? ledger.isPending ? <ContentState state="loading" /> : ledger.isError ? <ContentState state="error" description={getApiErrorMessage(ledger.error)} onAction={() => void ledger.refetch()} /> : <TablePanel title={t('admin.finance.ledger')} caption={t('pagination.total', { total: ledger.data.total })}><DataTable rowKey="id" loading={ledger.isFetching} columns={ledgerColumns} dataSource={ledger.data.items} emptyState={<EmptyState compact title={t('admin.finance.ledgerEmpty')} description={t('admin.finance.ledgerEmptyDescription')} />} pagination={{ current: ledgerPage, total: ledger.data.total, onChange: setLedgerPage }} /></TablePanel>
      : reconciliation.isPending ? <ContentState state="loading" /> : reconciliation.isError ? <ContentState state="error" description={getApiErrorMessage(reconciliation.error)} onAction={() => void reconciliation.refetch()} /> : <ReconciliationView report={reconciliation.data} money={money} />}
  </main>;
}

function ReconciliationView({ report, money }: { report: CodReconciliation; money: (value: number) => string }) {
  const { t } = useTranslation();
  const metrics: Array<[string, string, string?]> = [
    [t('sellerFinance.codSettlements'), String(report.settlementsCount)],
    [t('sellerFinance.codExpected'), money(report.expectedCodAmount)],
    [t('sellerFinance.codCollected'), money(report.collectedCodAmount)],
    [t('sellerFinance.codDifference'), money(report.difference), report.difference < 0 ? styles.expense : undefined],
    [t('sellerFinance.codCommission'), money(report.expectedCommission)],
    [t('sellerFinance.codNetted'), money(report.nettedCommission)],
    [t('sellerFinance.codOutstanding'), money(report.outstandingCommission), report.outstandingCommission > 0 ? styles.expense : undefined],
  ];
  return <section className={styles.report} aria-label={t('admin.finance.reconciliation')}>{metrics.map(([label, value, tone]) => <article className={styles.metric} key={label}><span>{label}</span><strong className={tone}>{value}</strong></article>)}</section>;
}
