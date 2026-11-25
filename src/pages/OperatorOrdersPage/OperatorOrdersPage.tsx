import { Tooltip } from 'antd';
import { Ban, Calendar, ChevronRight, Lock, Monitor, RotateCcw, Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LEAD_PERIODS, leadPeriodRange, leadPeriodText, parseLeadPeriod, type LeadPeriod } from '../../features/adminLeads/lib/leadRows';
import { useCurrentUserQuery } from '../../features/auth/api/useCurrentUserQuery';
import { DEFAULT_MAX_BOOKINGS, useOperatorLeadsQuery, useOperatorStateQuery } from '../../features/operator/api/operatorQueries';
import { useOrdersQuery } from '../../features/orders/api/ordersQueries';
import { isCancelable, OPERATOR_ORDER_GROUPS } from '../../features/orders/lib/orderStatus';
import { orderNumber } from '../../features/orders/lib/orderView';
import { ORDER_STATUSES, type OrderListItem, type OrderListQuery, type OrderStatus } from '../../features/orders/model/orderTypes';
import { CancelOrderDialog } from '../../features/orders/ui/CancelOrderDialog';
import { OrderPanel } from '../../features/orders/ui/OrderPanel';
import { OrderStatusTabs, type OrderTab } from '../../features/orders/ui/OrderStatusTabs';
import { OrdersTable, type OrderColumn } from '../../features/orders/ui/OrdersTable';
import { rich } from '../../shared/i18n/richText';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { tashkentClock } from '../../shared/lib/tashkentTime';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { useNow } from '../../shared/lib/useNow';
import { DotLabel } from '../../shared/ui/Badge/Badge';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { Pager } from '../../shared/ui/Pager/Pager';
import { PAGE_SIZES } from '../../shared/ui/Pager/pagerItems';
import { PillSelect, type PillOption } from '../../shared/ui/PillSelect/PillSelect';
import styles from './OperatorOrdersPage.module.css';

const WHERE = ['CENTER', 'ADDRESS'] as const;
const FILTER_KEYS = ['q', 'product', 'where', 'period'] as const;
const COLUMNS: readonly OrderColumn[] = ['order', 'customer', 'product', 'total', 'status', 'cancel'];

/** «Bekor qilish» ustunidagi qulf: yorliq va sababi (maslahatda). */
const LOCK: Partial<Record<OrderStatus, { label: TranslationKey; reason: TranslationKey }>> = {
  HANDED_TO_ELCHI: { label: 'ord.op.lockElchi', reason: 'ord.op.reasonElchi' },
  IN_TRANSIT: { label: 'ord.op.lockElchi', reason: 'ord.op.reasonElchi' },
  DELIVERED: { label: 'ord.op.lockDelivered', reason: 'ord.op.reasonDelivered' },
  REMITTED: { label: 'ord.op.lockDelivered', reason: 'ord.op.reasonDelivered' },
  RETURN_REQUESTED: { label: 'ord.op.lockDelivered', reason: 'ord.op.reasonReturn' },
  SETTLED: { label: 'ord.op.lockClosed', reason: 'ord.op.reasonClosed' },
  REFUSED: { label: 'ord.op.lockReturning', reason: 'ord.op.reasonReturning' },
  RETURNING: { label: 'ord.op.lockReturning', reason: 'ord.op.reasonReturning' },
  RETURNED_GRADED: { label: 'ord.op.lockClosed', reason: 'ord.op.reasonGraded' },
};

const parseTab = (value: string | null): OrderTab => ((ORDER_STATUSES as readonly string[]).includes(value ?? '') ? (value as OrderTab) : 'ALL');

/**
 * «Mening buyurtmalarim» (FE-26, operator-buyurtmalarim; taklif `GET /operator/orders`): operator «Buyurtma tasdiqlandi»
 * natijasini kiritgan lidlar. Holat tablari («Bekor qilindi» — Omborda guruhida), 3 filtr, raqam bosilsa panel 560,
 * Elchi'ga topshirilgunga qadar bekor qilish (BUY-3). Mijoz raqami ko'rinmaydi. Telefonda ish joyi ochilmaydi.
 */
export default function OperatorOrdersPage() {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const now = useNow();
  const searchId = useId();
  const headingId = useId();
  const me = shortPersonName(useCurrentUserQuery().data?.name ?? '');
  const [params, setParams] = useSearchParams();

  const tab = parseTab(params.get('status'));
  const productId = params.get('product') ?? '';
  const where = (WHERE as readonly string[]).includes(params.get('where') ?? '') ? params.get('where') ?? '' : '';
  const period = parseLeadPeriod(params.get('period'));
  const sort: NonNullable<OrderListQuery['sort']> = params.get('sort') === 'statusAt' ? 'statusAt' : '-statusAt';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const size = (PAGE_SIZES as readonly number[]).includes(Number(params.get('size'))) ? Number(params.get('size')) : PAGE_SIZES[0];
  const [search, setSearch] = useState(params.get('q') ?? '');
  const term = useDebouncedValue(search.trim(), 300);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<OrderListItem | null>(null);

  const range = period ? leadPeriodRange(period) : null;
  const query: OrderListQuery = {
    ...(tab !== 'ALL' ? { status: tab } : {}),
    ...(term ? { search: term } : {}),
    ...(productId ? { productId } : {}),
    ...(where ? { whereDeliver: where as 'CENTER' | 'ADDRESS' } : {}),
    ...(range ? { from: range.from, to: range.to } : {}),
    sort,
    page,
    limit: size,
  };
  const orders = useOrdersQuery('OPERATOR', query, !phone);
  const data = orders.data;
  const raw = useMemo(() => data?.items ?? [], [data]);
  // O'zi bekor qilgan buyurtma: «11:50 · siz bekor qildingiz».
  const rows = useMemo(() => raw.map((order) => (order.status === 'CANCELLED' && me && order.statusDetail === me ? { ...order, statusDetail: t('ord.op.youCancelled') } : order)), [raw, me, t]);
  const total = data?.total ?? 0;
  const counts = data?.counts ?? null;
  const panelOrder = raw.find((order) => order.id === panelId) ?? null;

  const update = (patch: Record<string, string | undefined>, keepPage = false) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!keepPage) next.delete('page');
    setParams(next, { replace: true });
  };
  const resetFilters = () => {
    setSearch('');
    update(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])));
  };

  if (phone) return <PhoneStub />;

  const all = t('al.filter.all');
  const productOptions: PillOption[] = [{ value: '', label: all }, ...(data?.facets?.products ?? []).map((item) => ({ value: item.id, label: item.name }))];
  const whereOptions: PillOption[] = [{ value: '', label: all }, ...WHERE.map((code) => ({ value: code, label: t(`ord.where.${code}`) }))];
  const periodLabel = (value: LeadPeriod) => t(`al.period.${value}`, { range: leadPeriodText(value, now) });
  const periodOptions: PillOption[] = [{ value: '', label: t('al.period.all') }, ...LEAD_PERIODS.map((value) => ({ value, label: periodLabel(value) }))];
  const nameOf = (list: PillOption[], value: string) => list.find((item) => item.value === value)?.label ?? value;
  const filters = [
    { key: 'product', label: t('ord.filter.product'), value: productId, options: productOptions, chip: nameOf(productOptions, productId) },
    { key: 'where', label: t('ord.filter.where'), value: where, options: whereOptions, chip: nameOf(whereOptions, where) },
    { key: 'period', label: t('ord.filter.period'), value: period ?? '', options: periodOptions, chip: period ? leadPeriodText(period, now) : '', icon: Calendar },
  ];
  const active = filters.filter((item) => item.value);
  const filtered = Boolean(term) || active.length > 0;
  const caption = t(active.length ? 'ord.op.captionFiltered' : 'ord.op.caption', { filters: active.map((item) => item.chip).join(', ') });

  const cancelCell = (order: OrderListItem) => {
    const number = orderNumber(order);
    if (isCancelable(order.status)) {
      return <button type="button" className={styles.cancelButton} aria-label={t('ord.op.cancelAria', { id: number })} onClick={() => setCancelling(order)}><Ban aria-hidden />{t('ord.menu.cancel')}</button>;
    }
    const lock = LOCK[order.status];
    if (!lock) return <span className={styles.muted}>—</span>;
    const reason = t(lock.reason);
    return (
      <Tooltip title={order.status === 'HANDED_TO_ELCHI' || order.status === 'IN_TRANSIT' ? `${reason}. ${t('ord.op.reasonElchiMore')}` : reason} placement="left">
        <span className={styles.locked} tabIndex={0}><Lock aria-hidden />{t(lock.label)}<span className={styles.visuallyHidden}>: {reason}</span></span>
      </Tooltip>
    );
  };

  const loading = orders.isPending;
  const failed = orders.isError && !data;
  const emptyRow = !loading && !failed && !rows.length ? (
    <div className={styles.message} data-testid="orders-empty">
      <span className={styles.messageIcon} aria-hidden><Search /></span>
      <span className={styles.messageText}>
        <span>{t(filtered || tab !== 'ALL' ? 'ord.empty.filteredTitle' : 'ord.op.emptyTitle')}</span>
        <span>{t(filtered || tab !== 'ALL' ? 'ord.empty.filteredText' : 'ord.op.emptyText')}</span>
      </span>
      {filtered ? <button type="button" className={styles.secondarySmall} onClick={resetFilters}><RotateCcw aria-hidden />{t('al.filtersReset')}</button> : null}
    </div>
  ) : failed ? <LoadError variant="row" error={orders.error} onRetry={() => void orders.refetch()} title={t('al.loadError')} /> : null;

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby={headingId}>
        <div className={styles.head}>
          <div>
            <h2 id={headingId}>{t('ord.op.title')}</h2>
            <p>{t('ord.op.subtitle')} <span className={styles.tabular}>{orders.dataUpdatedAt ? tashkentClock(orders.dataUpdatedAt) : '—'}</span></p>
          </div>
          <Link to="/operator/stats" className={styles.link}>{t('ord.op.stats')}<ChevronRight aria-hidden /></Link>
        </div>
        <OrderStatusTabs value={tab} counts={counts} groups={OPERATOR_ORDER_GROUPS} showProblem={false} warehouseLabel="ord.group.warehouseOperator" onChange={(next) => update({ status: next === 'ALL' ? undefined : next })} />
        <div className={styles.filters} role="search" aria-label={t('ord.filters')}>
          <span className={styles.search}>
            <Search aria-hidden />
            <label htmlFor={searchId} className={styles.visuallyHidden}>{t('ord.search')}</label>
            <input id={searchId} type="search" value={search} placeholder={t('ord.op.searchPlaceholder')} onChange={(event) => { setSearch(event.target.value); update({ q: event.target.value.trim() || undefined }); }} />
          </span>
          {filters.map((item) => (
            <PillSelect
              key={item.key}
              className={styles.pill}
              label={item.label}
              value={item.value}
              options={item.options}
              icon={item.icon}
              onChange={(value) => update({ [item.key]: value || undefined })}
              onClear={() => update({ [item.key]: undefined })}
              clearLabel={t('al.filter.clear', { name: item.label })}
            />
          ))}
          <span className={styles.filtersEnd}>
            <button type="button" className={styles.ghost} onClick={resetFilters} disabled={!filtered}><RotateCcw aria-hidden />{t('al.filtersReset')}</button>
          </span>
        </div>
        <OrdersTable
          rows={rows}
          columns={COLUMNS}
          hrefOf={() => '#'}
          now={now}
          caption={loading ? t('ord.captionLoading') : caption}
          sort={sort}
          onSort={() => update({ sort: sort === '-statusAt' ? 'statusAt' : undefined })}
          onOpen={(order) => setPanelId(order.id)}
          openByNumber
          activeId={panelId}
          cancelCell={cancelCell}
          body={emptyRow}
          loading={loading}
        />
        {total > 0 ? (
          <Pager page={page} pageSize={size} total={total} totalLabel={t('ord.pagerTotal', { total })} onPage={(next) => update({ page: next > 1 ? String(next) : undefined }, true)} onPageSize={(next) => update({ size: next === PAGE_SIZES[0] ? undefined : String(next) })} />
        ) : null}
      </section>
      <p className={styles.note}>{rich(t('ord.op.note'), { warehouse: <strong>{t('ord.group.warehouse')}</strong>, elchi: <strong>{t('ord.group.elchi')}</strong> })}</p>

      {panelOrder ? (
        <OrderPanel
          order={panelOrder}
          role="OPERATOR"
          href="#"
          actions={[]}
          onAction={() => undefined}
          onClose={() => setPanelId(null)}
          canRevealPhone={false}
          canPrintLabel={false}
          me={me}
          onCancel={() => setCancelling(panelOrder)}
        />
      ) : null}
      {cancelling ? <CancelOrderDialog order={cancelling} role="OPERATOR" onClose={() => setCancelling(null)} /> : null}
    </div>
  );
}

/** Telefonda ish joyi ochilmaydi (karkas-E 4.7, operator-buyurtmalarim.mobil): holat, bronlar va bugungi tasdiqlar. */
function PhoneStub() {
  const { t } = useTranslation();
  const stateQuery = useOperatorStateQuery();
  const leads = useOperatorLeadsQuery();
  const today = useOrdersQuery('OPERATOR', { from: leadPeriodRange('today').from, to: leadPeriodRange('today').to, page: 1, limit: 1 });
  const state = stateQuery.data?.state ?? 'OFFLINE';
  const max = stateQuery.data?.maxBookings ?? DEFAULT_MAX_BOOKINGS;
  const bookings = (leads.data ?? []).filter((lead) => lead.status === 'BOOKED').length;
  return (
    <div className={styles.phonePage} data-testid="operator-phone">
      <section className={styles.phoneCard} aria-labelledby="operator-orders-desktop-only">
        <span className={styles.phoneIcon} aria-hidden><Monitor /></span>
        <h2 id="operator-orders-desktop-only">{t('shell.desktopOnlyTitle')}</h2>
        <p>{t('shell.desktopOnlyText')}</p>
      </section>
      <section className={styles.phoneState} aria-label={t('opo.phoneStateLabel')}>
        <div><span>{t('opo.phoneState')}</span><DotLabel tone={state === 'ONLINE' ? 'success' : state === 'BREAK' ? 'warning' : 'neutral'}>{t(state === 'ONLINE' ? 'operator.online' : state === 'BREAK' ? 'operator.break' : 'operator.offline')}</DotLabel></div>
        <div><span>{t('opo.phoneBookings')}</span><strong>{bookings}/{max}</strong></div>
        <div><span>{t('ord.op.todayConfirmed')}</span><strong>{t('ord.op.todayValue', { count: today.data?.total ?? 0 })}</strong></div>
        <p>{t('ord.op.phoneNote')}</p>
      </section>
    </div>
  );
}
