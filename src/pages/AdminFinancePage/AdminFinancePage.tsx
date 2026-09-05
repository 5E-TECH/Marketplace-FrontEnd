import { App, Button, Input, Select, Space, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Check, CirclePause, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useAdminPayoutsQuery, useFinanceReportQuery, usePayoutActionMutation } from '../../features/adminFinance/api/adminFinanceQueries';
import type { AdminPayout, PayoutAction, PayoutStatus, ReportParams } from '../../features/adminFinance/model/adminFinanceTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime } from '../../shared/lib/date';
import { flattenPrimitiveEntries } from '../../shared/lib/primitiveEntries';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import styles from './AdminFinancePage.module.css';

type FinanceTab = 'payouts' | 'reports' | 'reconciliation';
type StatusFilter = 'ALL' | PayoutStatus;
const payoutStatuses: PayoutStatus[] = ['PENDING', 'APPROVED', 'HELD', 'PAID'];

export default function AdminFinancePage() {
  const { message } = App.useApp(); const [tab, setTab] = useState<FinanceTab>('payouts'); const [shopId, setShopId] = useState(''); const [status, setStatus] = useState<StatusFilter>('ALL'); const [page, setPage] = useState(1); const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const reportParams: ReportParams = { ...(shopId ? { shopId } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
  const payouts = useAdminPayoutsQuery({ page, limit: 20, ...(shopId ? { shopId } : {}), ...(status !== 'ALL' ? { status } : {}) }, tab === 'payouts');
  const reports = useFinanceReportQuery('reports', reportParams, tab === 'reports'); const reconciliation = useFinanceReportQuery('reconciliation', reportParams, tab === 'reconciliation'); const mutation = usePayoutActionMutation();
  const runAction = (row: AdminPayout, action: PayoutAction) => mutation.mutate({ id: row.id, action }, { onSuccess: () => void message.success('Payout holati yangilandi'), onError: error => void message.error(getAuthErrorMessage(error)) });
  const columns: ColumnsType<AdminPayout> = [
    { title: 'Payout', render: (_, row) => `#${row.id}` }, { title: 'Do‘kon', render: (_, row) => row.shopName || (row.shopId ? `#${row.shopId}` : '—') }, { title: 'Summa', dataIndex: 'amount', render: (value: number) => `${formatMoney(value)} UZS` }, { title: 'Holati', dataIndex: 'status', width: 120, render: (value: PayoutStatus) => <StatusTag status={value} /> }, { title: 'Yaratilgan', dataIndex: 'createdAt', responsive: ['lg'], render: (value: string) => value ? formatDateTime(value) : '—' },
    { title: 'Amallar', width: 180, render: (_, row) => <Space wrap>{row.status === 'PENDING' ? <Button size="small" type="primary" icon={<Check size={15} />} loading={mutation.isPending} onClick={() => runAction(row, 'approve')}>Tasdiqlash</Button> : null}{row.status !== 'HELD' && row.status !== 'PAID' ? <Button size="small" icon={<CirclePause size={15} />} loading={mutation.isPending} onClick={() => runAction(row, 'hold')}>Ushlash</Button> : null}{row.status === 'HELD' ? <Button size="small" type="primary" icon={<Check size={15} />} loading={mutation.isPending} onClick={() => runAction(row, 'release')}>Chiqarish</Button> : null}</Space> },
  ];
  const activeReport = tab === 'reports' ? reports : reconciliation;
  return <main><PageHeader title="Moliya va payoutlar" description="Payout so‘rovlari, moliyaviy hisobotlar va reconciliation" /><Tabs activeKey={tab} onChange={value => setTab(value as FinanceTab)} items={[{ key: 'payouts', label: 'Payoutlar' }, { key: 'reports', label: 'Hisobot' }, { key: 'reconciliation', label: 'Reconciliation' }]} />
    <FilterPanel className={styles.toolbar} aria-label="Moliya filtrlari"><Input value={shopId} inputMode="numeric" allowClear placeholder="Do‘kon ID" aria-label="Do‘kon ID" onChange={event => { setShopId(event.target.value.replace(/\D/g, '')); setPage(1); }} />{tab === 'payouts' ? <Select<StatusFilter> value={status} aria-label="Payout holati" options={[{ value: 'ALL', label: 'Barcha holatlar' }, ...payoutStatuses.map(value => ({ value, label: value }))]} onChange={value => { setStatus(value); setPage(1); }} /> : <><Input type="date" value={dateFrom} max={dateTo || undefined} aria-label="Boshlanish sanasi" onChange={event => setDateFrom(event.target.value)} /><Input type="date" value={dateTo} min={dateFrom || undefined} aria-label="Tugash sanasi" onChange={event => setDateTo(event.target.value)} /></>}<Button icon={<RotateCcw size={16} />} disabled={!shopId && status === 'ALL' && !dateFrom && !dateTo} onClick={() => { setShopId(''); setStatus('ALL'); setDateFrom(''); setDateTo(''); setPage(1); }}>Tozalash</Button></FilterPanel>
    {tab === 'payouts' ? payouts.isPending ? <ContentState state="loading" /> : payouts.isError ? <ContentState state="error" description={getAuthErrorMessage(payouts.error)} onAction={() => void payouts.refetch()} /> : <div className={styles.table}><DataTable rowKey="id" columns={columns} dataSource={payouts.data.items} scroll={{ x: 820 }} emptyState={<EmptyState compact title="Payoutlar topilmadi" description="Tanlangan filterlar bo‘yicha payout mavjud emas." />} pagination={{ ...createTablePagination(20), current: page, total: payouts.data.total }} onChange={value => setPage(value.current ?? 1)} /></div> : activeReport.isPending ? <ContentState state="loading" /> : activeReport.isError ? <ContentState state="error" description={getAuthErrorMessage(activeReport.error)} onAction={() => void activeReport.refetch()} /> : <ReportView value={activeReport.data} />}
  </main>;
}

function ReportView({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object') return <EmptyState compact title="Hisobot bo‘sh" description="Tanlangan davr uchun ma’lumot mavjud emas." />;
  const rows = flattenPrimitiveEntries(value);
  if (!rows.length) return <EmptyState compact title="Hisobot bo‘sh" description="Tanlangan davr uchun ma’lumot mavjud emas." />;
  return <section className={styles.report}>{rows.map(([label, content]) => <article className={styles.metric} key={label}><span>{label}</span><strong>{typeof content === 'number' ? formatMoney(content) : String(content)}</strong></article>)}</section>;
}
