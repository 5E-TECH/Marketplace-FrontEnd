import { Alert, App, Button, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Check, CircleCheckBig, CirclePause, Clock, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePayoutScheduleQuery, useSellerFinanceSummaryQuery, useSellerLedgerQuery, useSellerPayoutsQuery, useUpdatePayoutScheduleMutation } from '../../features/sellerFinance/api/sellerFinanceQueries';
import type { CodReconciliation, LedgerEntry, LedgerEntryType, PayoutFrequency, SellerPayout, SellerPayoutStatus } from '../../features/sellerFinance/model/sellerFinanceTypes';
import { ENTRY_LABELS, PAYOUT_STATUSES, PAYOUT_STATUS_LABELS, REFERENCE_LABELS } from '../../features/sellerFinance/lib/financeLabels';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { TABLE_PAGE_SIZE } from '../../shared/config/pagination';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatDate, formatDateTime } from '../../shared/lib/date';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { DateRangeFilter } from '../../shared/ui/DateRangeFilter/DateRangeFilter';
import { DetailList } from '../../shared/ui/DetailList/DetailList';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { FilterSelect } from '../../shared/ui/FilterPanel/FilterSelect';
import { SelectControl } from '../../shared/ui/FormControls/FormControls';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { ResetFiltersButton } from '../../shared/ui/ResetFiltersButton/ResetFiltersButton';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { SummaryCard } from '../../shared/ui/SummaryCard/SummaryCard';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './FinancePage.module.css';

const DATE = 'YYYY-MM-DD';
const isDate = (value: string | null): value is string => Boolean(value && dayjs(value, DATE, true).isValid());
/** Standart davr — joriy oy boshidan bugungacha. */
const defaultRange = (): [string, string] => [dayjs().startOf('month').format(DATE), dayjs().format(DATE)];
/**
 * Backend `YYYY-MM-DD` beradi — UTC yarim tun emas, mahalliy kun sifatida o'qiladi.
 * uz: Chrome `2026-10-05` beradi — `formatDateTime` dagi kabi `dd.mm.yyyy` qilamiz.
 */
const formatDay = (value: string, locale: string) => !isDate(value) ? value : locale.startsWith('uz') ? dayjs(value).format('DD.MM.YYYY') : formatDate(`${value}T00:00:00`, locale);

type FinanceTab = 'ledger' | 'payouts';
type PayoutStatusFilter = 'ALL' | SellerPayoutStatus;
const FREQUENCIES: PayoutFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
const FREQUENCY_LABELS: Record<PayoutFrequency, [TranslationKey, TranslationKey]> = {
  DAILY: ['sellerFinance.frequency.DAILY', 'sellerFinance.frequency.DAILY.hint'],
  WEEKLY: ['sellerFinance.frequency.WEEKLY', 'sellerFinance.frequency.WEEKLY.hint'],
  MONTHLY: ['sellerFinance.frequency.MONTHLY', 'sellerFinance.frequency.MONTHLY.hint'],
};

/**
 * Sotuvchi moliyasi — backend hisobidan (`/seller/finance/*`, do'kon token'dan):
 * balans va payout'lar jamlanmasi, to'lov jadvali, COD hisob-kitobi, ledger va payout'lar ro'yxati.
 * Frontend hech narsani qayta hisoblamaydi.
 */
export default function FinancePage() {
  const { locale, t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialFrom, initialTo] = defaultRange();
  const from = searchParams.has('from') ? (isDate(searchParams.get('from')) ? searchParams.get('from')! : '') : initialFrom;
  const to = searchParams.has('to') ? (isDate(searchParams.get('to')) ? searchParams.get('to')! : '') : initialTo;
  const [tab, setTab] = useState<FinanceTab>('ledger');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatusFilter>('ALL');
  const range = { ...(from ? { dateFrom: from } : {}), ...(to ? { dateTo: to } : {}) };
  const summaryQuery = useSellerFinanceSummaryQuery(range);
  const ledgerQuery = useSellerLedgerQuery({ page: ledgerPage, limit: TABLE_PAGE_SIZE, ...range }, tab === 'ledger');
  const payoutsQuery = useSellerPayoutsQuery({ page: payoutPage, limit: TABLE_PAGE_SIZE, ...(payoutStatus !== 'ALL' ? { status: payoutStatus } : {}) }, tab === 'payouts');
  const money = (value: number) => `${formatMoney(value)} ${t('product.currency')}`;
  const signedMoney = (value: number) => `${value > 0 ? '+' : ''}${money(value)}`;
  const isDefault = from === initialFrom && to === initialTo;

  // Davr URL'da saqlanadi: sahifa yangilansa yoki havola ulashilsa ham o'sha davr ochiladi.
  const changeRange = ([nextFrom, nextTo]: [string, string]) => {
    setLedgerPage(1);
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set('from', nextFrom); next.set('to', nextTo); return next; }, { replace: true });
  };
  const resetRange = () => {
    setLedgerPage(1);
    setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('from'); next.delete('to'); return next; }, { replace: true });
  };

  const summary = summaryQuery.data;
  const cards = summary ? [
    { title: t('sellerFinance.balance'), value: money(summary.balance), caption: t(summary.balance < 0 ? 'sellerFinance.balanceDebt' : 'sellerFinance.balanceCaption'), icon: <Wallet />, tone: summary.balance < 0 ? 'warning' as const : 'success' as const },
    { title: t('sellerFinance.pendingPayouts'), value: money(summary.pendingPayoutAmount), caption: t('sellerFinance.nextPayout', { date: formatDay(summary.nextPayoutDate, locale) }), icon: <Clock />, tone: 'info' as const },
    { title: t('sellerFinance.heldPayouts'), value: money(summary.heldPayoutAmount), caption: t('sellerFinance.heldCaption'), icon: <CirclePause />, tone: 'warning' as const },
    { title: t('sellerFinance.paidPayouts'), value: money(summary.paidPayoutAmount), caption: t('sellerFinance.paidCaption'), icon: <CircleCheckBig />, tone: 'success' as const },
  ] : [];

  const ledgerColumns: ColumnsType<LedgerEntry> = [
    { title: t('sellerFinance.date'), dataIndex: 'createdAt', render: (value: string) => formatDateTime(value, locale) },
    { title: t('sellerFinance.entryType'), dataIndex: 'entryType', render: (value: LedgerEntryType) => <Tag>{t(ENTRY_LABELS[value])}</Tag> },
    { title: t('sellerFinance.reference'), responsive: ['md'], render: (_, entry) => { const label = REFERENCE_LABELS[entry.referenceType]; return `${label ? t(label) : entry.referenceType} #${entry.referenceId}`; } },
    { title: t('sellerFinance.amount'), dataIndex: 'amount', align: 'right', render: (value: number) => <strong className={`${styles.amount} ${value < 0 ? styles.expense : styles.income}`}>{signedMoney(value)}</strong> },
    { title: t('sellerFinance.balanceAfter'), dataIndex: 'balanceAfter', align: 'right', responsive: ['lg'], render: (value: number) => <span className={styles.amount}>{money(value)}</span> },
  ];

  const payoutColumns: ColumnsType<SellerPayout> = [
    { title: t('sellerFinance.payout'), render: (_, payout) => <strong>#{payout.id}</strong> },
    { title: t('sellerFinance.parcel'), dataIndex: 'referenceId', responsive: ['md'], render: (value: string) => `#${value}` },
    { title: t('sellerFinance.amount'), dataIndex: 'amount', align: 'right', render: (value: number) => <strong className={styles.amount}>{money(value)}</strong> },
    { title: t('sellerFinance.status'), dataIndex: 'status', render: (value: SellerPayoutStatus) => <StatusTag status={value} /> },
    { title: t('sellerFinance.createdAt'), dataIndex: 'createdAt', responsive: ['lg'], render: (value: string) => formatDateTime(value, locale) },
    { title: t('sellerFinance.paidAt'), dataIndex: 'paidAt', responsive: ['sm'], render: (value: string | null) => value ? formatDateTime(value, locale) : '—' },
  ];

  return <main className={styles.page}>
    <PageHeader title={t('sellerFinance.title')} description={t('sellerFinance.description')} />
    <FilterPanel className={styles.filterPanel} aria-label={t('sellerFinance.filters')}>
      <DateRangeFilter className={styles.dateRange} value={[from, to]} startLabel={t('sellerFinance.dateFrom')} endLabel={t('sellerFinance.dateTo')} onChange={changeRange} />
      <div className={styles.filterAction}><ResetFiltersButton disabled={isDefault} onClick={resetRange} /></div>
    </FilterPanel>
    <Alert className={styles.notice} type="info" showIcon title={t('sellerFinance.notice')} />
    {summaryQuery.isError && !summary ? <ContentState state="error" title={t('sellerFinance.summaryError')} description={getApiErrorMessage(summaryQuery.error)} onAction={() => void summaryQuery.refetch()} />
      : !summary ? <ContentState state="loading" />
      : <>
        <section className={styles.metricGrid} aria-label={t('sellerFinance.summary')} aria-busy={summaryQuery.isFetching}>
          {cards.map((card) => <SummaryCard key={card.title} {...card} />)}
        </section>
        <div className={styles.panels}>
          <PayoutSchedulePanel />
          <CodPanel cod={summary.cod} money={money} />
        </div>
      </>}
    <Tabs className={styles.tabs} activeKey={tab} onChange={(value) => setTab(value as FinanceTab)} items={[{ key: 'ledger', label: t('sellerFinance.ledger') }, { key: 'payouts', label: t('sellerFinance.payouts') }]} />
    {tab === 'ledger'
      ? ledgerQuery.isError ? <ContentState state="error" title={t('sellerFinance.ledgerError')} description={getApiErrorMessage(ledgerQuery.error)} onAction={() => void ledgerQuery.refetch()} />
        : !ledgerQuery.data ? <ContentState state="loading" />
        : <TablePanel title={t('sellerFinance.ledger')} caption={t('pagination.total', { total: ledgerQuery.data.total })}>
          <DataTable<LedgerEntry> loading={ledgerQuery.isFetching} rowKey="id" columns={ledgerColumns} dataSource={ledgerQuery.data.items} tableLayout="auto" emptyState={<EmptyState compact title={t('sellerFinance.ledgerEmpty')} description={t('sellerFinance.ledgerEmptyDescription')} />} pagination={{ current: ledgerPage, total: ledgerQuery.data.total, onChange: setLedgerPage }} />
        </TablePanel>
      : payoutsQuery.isError ? <ContentState state="error" title={t('sellerFinance.payoutsError')} description={getApiErrorMessage(payoutsQuery.error)} onAction={() => void payoutsQuery.refetch()} />
        : !payoutsQuery.data ? <ContentState state="loading" />
        : <TablePanel title={t('sellerFinance.payouts')} caption={t('pagination.total', { total: payoutsQuery.data.total })} action={<FilterSelect<PayoutStatusFilter> className={styles.statusFilter} value={payoutStatus} aria-label={t('sellerFinance.payoutStatus')} options={[{ value: 'ALL', label: t('sellerFinance.allStatuses') }, ...PAYOUT_STATUSES.map((value) => ({ value, label: t(PAYOUT_STATUS_LABELS[value]) }))]} onChange={(value) => { setPayoutStatus(value); setPayoutPage(1); }} />}>
          <DataTable<SellerPayout> loading={payoutsQuery.isFetching} rowKey="id" columns={payoutColumns} dataSource={payoutsQuery.data.items} tableLayout="auto" emptyState={<EmptyState compact title={t('sellerFinance.payoutsEmpty')} description={t('sellerFinance.payoutsEmptyDescription')} />} pagination={{ current: payoutPage, total: payoutsQuery.data.total, onChange: setPayoutPage }} />
        </TablePanel>}
  </main>;
}

/** To'lov chastotasi: sotuvchi o'zi tanlaydi (`PUT /seller/finance/payout-schedule`). */
function PayoutSchedulePanel() {
  const { message } = App.useApp();
  const { locale, t } = useTranslation();
  const scheduleQuery = usePayoutScheduleQuery();
  const mutation = useUpdatePayoutScheduleMutation();
  const [draft, setDraft] = useState<PayoutFrequency | null>(null);
  const schedule = scheduleQuery.data;
  const value = draft ?? schedule?.frequency;
  const options = FREQUENCIES.map((frequency) => ({ value: frequency, label: t(FREQUENCY_LABELS[frequency][0]), description: t(FREQUENCY_LABELS[frequency][1]) }));
  const save = () => {
    if (!draft) return;
    mutation.mutate(draft, {
      onSuccess: () => { setDraft(null); void message.success(t('sellerFinance.scheduleSaved')); },
      onError: (error) => void message.error(getApiErrorMessage(error)),
    });
  };

  return <TablePanel className={styles.panel} title={t('sellerFinance.schedule')} caption={schedule ? t('sellerFinance.nextPayout', { date: formatDay(schedule.nextPayoutDate, locale) }) : undefined}>
    {scheduleQuery.isError ? <ContentState state="error" title={t('sellerFinance.scheduleError')} description={getApiErrorMessage(scheduleQuery.error)} onAction={() => void scheduleQuery.refetch()} />
      : !schedule ? <ContentState state="loading" />
      : <div className={styles.schedule}>
        <div className={styles.scheduleControls} role="group" aria-label={t('sellerFinance.scheduleLabel')}>
          <SelectControl value={value} options={options} disabled={mutation.isPending} onChange={(next) => setDraft(next as PayoutFrequency)} />
          <Button type="primary" icon={<Check size={16} />} loading={mutation.isPending} disabled={!draft || draft === schedule.frequency} onClick={save}>{t('sellerFinance.scheduleSave')}</Button>
        </div>
        {schedule.isDefault ? <small className={styles.muted}>{t('sellerFinance.scheduleDefault')}</small> : null}
      </div>}
  </TablePanel>;
}

function CodPanel({ cod, money }: { cod: CodReconciliation; money: (value: number) => string }) {
  const { t } = useTranslation();
  return <TablePanel className={styles.panel} title={t('sellerFinance.cod')} caption={t('sellerFinance.codCaption')}>
    <DetailList items={[
      { label: t('sellerFinance.codSettlements'), value: String(cod.settlementsCount) },
      { label: t('sellerFinance.codExpected'), value: money(cod.expectedCodAmount) },
      { label: t('sellerFinance.codCollected'), value: money(cod.collectedCodAmount) },
      { label: t('sellerFinance.codDifference'), value: <span className={cod.difference < 0 ? styles.expense : undefined}>{money(cod.difference)}</span> },
      { label: t('sellerFinance.codCommission'), value: money(cod.expectedCommission) },
      { label: t('sellerFinance.codNetted'), value: money(cod.nettedCommission) },
      { label: t('sellerFinance.codOutstanding'), value: <span className={cod.outstandingCommission > 0 ? styles.expense : undefined}>{money(cod.outstandingCommission)}</span> },
    ]} />
  </TablePanel>;
}
