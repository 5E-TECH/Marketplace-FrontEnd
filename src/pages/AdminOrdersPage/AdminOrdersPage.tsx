import { Ban, Calendar, ChevronDown, Download, EllipsisVertical, Inbox, Info, ListFilter, ListOrdered, Lock, Package, RefreshCw, RotateCcw, Search, X } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLeadFilterOptionsQuery } from '../../features/adminLeads/api/adminLeadsQueries';
import { LEAD_PERIODS, leadPeriodRange, leadPeriodText, parseLeadPeriod, type LeadPeriod } from '../../features/adminLeads/lib/leadRows';
import { useRegionTree } from '../../features/address/api/regionsQueries';
import { useCurrentUserQuery } from '../../features/auth/api/useCurrentUserQuery';
import { exportOrders } from '../../features/orders/api/ordersApi';
import { useCustomerRequestsQuery, useOrdersQuery } from '../../features/orders/api/ordersQueries';
import { isCancelable, ORDER_GROUPS } from '../../features/orders/lib/orderStatus';
import { orderNumber } from '../../features/orders/lib/orderView';
import { ORDER_EXPORT_COLUMNS, ORDER_STATUSES, type CustomerRequestRow, type OrderListItem, type OrderListQuery, type OrderRole, type OrderStatus } from '../../features/orders/model/orderTypes';
import { CancelOrderDialog } from '../../features/orders/ui/CancelOrderDialog';
import { CustomerRequests, type DoneRequest } from '../../features/orders/ui/CustomerRequests';
import { AddressDialogFor, CloseRequestDialog } from '../../features/orders/ui/OrderCardDialogs';
import { OrderLabelDialog } from '../../features/orders/ui/OrderLabelDialog';
import { OrderPanel } from '../../features/orders/ui/OrderPanel';
import type { OrderAction } from '../../features/orders/ui/OrderRowMenu';
import { OrderRowMenu } from '../../features/orders/ui/OrderRowMenu';
import { OrderStatusTabs, type OrderTab } from '../../features/orders/ui/OrderStatusTabs';
import { OrderCards, OrdersTable, type OrderColumn } from '../../features/orders/ui/OrdersTable';
import { rich } from '../../shared/i18n/richText';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { tashkentClock, tashkentDay } from '../../shared/lib/tashkentTime';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { useNow } from '../../shared/lib/useNow';
import { CsvExportDialog } from '../../shared/ui/CsvExportDialog/CsvExportDialog';
import { Dialog, DialogCancel } from '../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { usePageStatus } from '../../shared/ui/PageHeader/pageTitle';
import { Pager } from '../../shared/ui/Pager/Pager';
import { PAGE_SIZES } from '../../shared/ui/Pager/pagerItems';
import { PillSelect, type PillOption } from '../../shared/ui/PillSelect/PillSelect';
import styles from './AdminOrdersPage.module.css';

const SOURCES = ['LANDING', 'SITE', 'API'] as const;
const WHERE = ['CENTER', 'ADDRESS'] as const;
const PHONE_STEP = 10;
const FILTER_KEYS = ['q', 'product', 'source', 'affiliate', 'region', 'where', 'period'] as const;
const COLUMNS: readonly OrderColumn[] = ['order', 'customer', 'stream', 'total', 'status', 'track'];
const ACTIONS: readonly OrderAction[] = ['open', 'lead', 'return', 'label', 'cancel'];
// Nazoratchi (nazoratchi-buyurtmalar): 3 filtr, «Tasdiqlagan» va «Bekor qilish» ustunlari, menyuda tasdiq qo'ng'irog'i.
const SUP_FILTER_KEYS = ['q', 'product', 'operator', 'period'] as const;
const SUP_COLUMNS: readonly OrderColumn[] = ['order', 'customer', 'confirmedBy', 'total', 'status', 'cancel'];
const SUP_ACTIONS: readonly OrderAction[] = ['open', 'lead', 'listen', 'cancel'];
/** «Bekor qilish» ustunida sabab: Elchi'ga topshirilgan yoki yetkazilgan. */
const DELIVERED_LIKE: readonly OrderStatus[] = ['DELIVERED', 'REMITTED', 'SETTLED', 'RETURN_REQUESTED'];
const RETURN_STATUSES = ORDER_GROUPS.find((group) => group.key === 'return')?.statuses ?? [];
/** Bo'lim tablari sonlari filtrga bog'liq emas (dizayn: «Bugun» filtrida ham «Buyurtmalar 102»). */
const TOTALS: OrderListQuery = { page: 1, limit: 1 };

const parseTab = (value: string | null): OrderTab => ((ORDER_STATUSES as readonly string[]).includes(value ?? '') ? (value as OrderTab) : 'ALL');

type DialogState =
  | { kind: 'cancel'; order: OrderListItem; request?: CustomerRequestRow }
  | { kind: 'label'; order: OrderListItem }
  | { kind: 'address'; orderId: string; request?: CustomerRequestRow }
  | { kind: 'closeRequest'; request: CustomerRequestRow }
  | { kind: 'csv' }
  | { kind: 'actions' }
  | { kind: 'filters' }
  | null;

/**
 * «Buyurtmalar» (FE-26, admin-buyurtmalar; BE-18): bo'limlar («Buyurtmalar», «Rad va qaytarishlar»), 13 holat
 * guruhlari bo'yicha tablar, qidiruv va 6 filtr, jadval (qator bosilsa — panel 560), sahifalash, har 60 soniyada
 * yangilanish. Bekor qilish — Elchi'ga topshirilgunga qadar (BUY-3); telefon bo'yicha qidiruv va CSV — faqat admin.
 * Nazoratchi (`/supervisor/orders`, nazoratchi-buyurtmalar): tepada mijoz so'rovlari, 3 filtr, «Bekor qilish» ustuni.
 */
export default function AdminOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const narrow = useMediaQuery('(max-width: 1023.98px)');
  const now = useNow();
  const searchId = useId();
  const [params, setParams] = useSearchParams();
  const user = useCurrentUserQuery().data;
  const admin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const role: OrderRole = admin ? 'ADMIN' : 'SUPERVISOR';
  const base = admin ? '/admin' : '/supervisor';
  const filterKeys = admin ? FILTER_KEYS : SUP_FILTER_KEYS;

  const tab = parseTab(params.get('status'));
  const productId = params.get('product') ?? '';
  const source = admin && (SOURCES as readonly string[]).includes(params.get('source') ?? '') ? params.get('source') ?? '' : '';
  const affiliateId = admin ? params.get('affiliate') ?? '' : '';
  const regionSoato = admin ? params.get('region') ?? '' : '';
  const where = admin && (WHERE as readonly string[]).includes(params.get('where') ?? '') ? params.get('where') ?? '' : '';
  const operatorId = admin ? '' : params.get('operator') ?? '';
  const period = parseLeadPeriod(params.get('period'));
  const sort: NonNullable<OrderListQuery['sort']> = params.get('sort') === 'statusAt' ? 'statusAt' : '-statusAt';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const size = (PAGE_SIZES as readonly number[]).includes(Number(params.get('size'))) ? Number(params.get('size')) : PAGE_SIZES[0];
  const [search, setSearch] = useState(params.get('q') ?? '');
  const term = useDebouncedValue(search.trim(), 300);
  const [phoneLimit, setPhoneLimit] = useState(PHONE_STEP);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [doneRequests, setDoneRequests] = useState<DoneRequest[]>([]);

  const range = period ? leadPeriodRange(period) : null;
  const query: OrderListQuery = {
    ...(tab !== 'ALL' ? { status: tab } : {}),
    ...(term ? { search: term } : {}),
    ...(productId ? { productId } : {}),
    ...(source ? { source } : {}),
    ...(affiliateId ? { affiliateId } : {}),
    ...(regionSoato ? { regionSoato } : {}),
    ...(where ? { whereDeliver: where as 'CENTER' | 'ADDRESS' } : {}),
    ...(operatorId ? { confirmedById: operatorId } : {}),
    ...(range ? { from: range.from, to: range.to } : {}),
    sort,
    page: phone ? 1 : page,
    limit: phone ? phoneLimit : size,
  };
  const orders = useOrdersQuery(role, query);
  const narrowed = Boolean(term || productId || source || affiliateId || regionSoato || where || operatorId || period);
  const totals = useOrdersQuery(role, TOTALS, admin && narrowed);
  const options = useLeadFilterOptionsQuery(admin);
  const openRequests = useCustomerRequestsQuery('OPEN');
  const regions = useRegionTree();
  const data = orders.data;
  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const counts = data?.counts ?? null;
  const panelOrder = rows.find((order) => order.id === panelId) ?? null;
  const panelRequest = admin || !panelOrder ? null : (openRequests.data ?? []).find((item) => item.orderId === panelOrder.id) ?? null;

  usePageStatus(narrow ? null : t('ord.live'), narrow || !orders.dataUpdatedAt ? null : tashkentClock(orders.dataUpdatedAt));

  const update = (patch: Record<string, string | undefined>, keepPage = false) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!keepPage) next.delete('page');
    setParams(next, { replace: true });
    if (!keepPage) setPhoneLimit(PHONE_STEP);
  };
  const resetFilters = () => {
    setSearch('');
    update(Object.fromEntries(filterKeys.map((key) => [key, undefined])));
  };
  const hrefOf = (order: Pick<OrderListItem, 'id'>) => `${base}/orders/${encodeURIComponent(order.id)}`;
  const leadHref = (leadId: string) => `${base}/leads/${encodeURIComponent(leadId)}`;
  // Mijoz so'rovi bajarilgach qator «Bajarildi» bilan qoladi (shu sessiyada).
  const markDone = (request: CustomerRequestRow) => setDoneRequests((list) => [...list, { row: request, at: new Date().toISOString(), by: shortPersonName(user?.name ?? '—') }]);

  const onAction = (order: OrderListItem, action: OrderAction) => {
    if (action === 'open') void navigate(hrefOf(order));
    else if (action === 'lead' && order.leadId) void navigate(leadHref(order.leadId));
    else if (action === 'listen' && order.leadId) void navigate(`${leadHref(order.leadId)}?listen=1`);
    else if (action === 'return') void navigate(`${hrefOf(order)}?return=1`);
    else if (action === 'label' || action === 'cancel') setDialog({ kind: action, order });
  };

  // ── Filtr variantlari ──
  const all = t('al.filter.all');
  const optionsOf = (list: Array<{ id: string; name: string }> | undefined): PillOption[] => [{ value: '', label: all }, ...(list ?? []).map((item) => ({ value: item.id, label: item.name }))];
  const productOptions = optionsOf(options.data?.products);
  const affiliateOptions = optionsOf(options.data?.affiliates);
  const operatorOptions = optionsOf(options.data?.operators);
  const regionOptions: PillOption[] = [{ value: '', label: all }, ...(regions.data ?? []).map((region) => ({ value: region.satoCode, label: region.name }))];
  const sourceOptions: PillOption[] = [{ value: '', label: all }, ...SOURCES.map((code) => ({ value: code, label: t(`al.source.${code}`) }))];
  const whereOptions: PillOption[] = [{ value: '', label: all }, ...WHERE.map((code) => ({ value: code, label: t(`ord.where.${code}`) }))];
  const periodLabel = (value: LeadPeriod) => t(`al.period.${value}`, { range: leadPeriodText(value, now) });
  const periodOptions: PillOption[] = [{ value: '', label: t('al.period.all') }, ...LEAD_PERIODS.map((value) => ({ value, label: periodLabel(value) }))];
  const nameOf = (list: PillOption[], value: string) => list.find((item) => item.value === value)?.label ?? value;

  // Varaqdagi izoh (admin-buyurtmalar.mobil «Filtrlar»): variantlar ro'yxati — «Sotuvchi sahifasi · Sayt · Lid API».
  const variants = (list: PillOption[]) => list.slice(1).map((item) => item.label).join(' · ');
  type FilterKey = (typeof FILTER_KEYS)[number] | (typeof SUP_FILTER_KEYS)[number];
  const periodFilter = { key: 'period' as const, label: t('ord.filter.period'), value: period ?? '', options: periodOptions, chip: period ? leadPeriodText(period, now) : '', icon: Calendar };
  const productFilter = { key: 'product' as const, label: t('ord.filter.product'), value: productId, options: productOptions, chip: nameOf(productOptions, productId) };
  const filters: Array<{ key: FilterKey; label: string; value: string; options: PillOption[]; chip: string; icon?: typeof Calendar; hint?: string }> = !admin ? [
    productFilter,
    { key: 'operator', label: t('ord.filter.operator'), value: operatorId, options: operatorOptions, chip: nameOf(operatorOptions, operatorId) },
    periodFilter,
  ] : [
    productFilter,
    { key: 'source', label: t('ord.filter.source'), value: source, options: sourceOptions, chip: nameOf(sourceOptions, source), hint: variants(sourceOptions) },
    { key: 'affiliate', label: t('ord.filter.affiliate'), value: affiliateId, options: affiliateOptions, chip: nameOf(affiliateOptions, affiliateId) },
    { key: 'region', label: t('ord.filter.region'), value: regionSoato, options: regionOptions, chip: nameOf(regionOptions, regionSoato) },
    { key: 'where', label: t('ord.filter.where'), value: where, options: whereOptions, chip: nameOf(whereOptions, where), hint: variants(whereOptions) },
    periodFilter,
  ];
  const active = filters.filter((item) => item.value);
  const filtered = Boolean(term) || active.length > 0;

  const summaryParts = active.map((item) => item.chip);
  const caption = t(summaryParts.length ? 'ord.captionFiltered' : 'ord.caption', { filters: summaryParts.join(', ') });
  const csvSummary = [
    productId ? nameOf(productOptions, productId) : null,
    period ? leadPeriodText(period, now) : t('al.allTime'),
    tab === 'ALL' ? t('al.allStatuses') : t(`status.order.${tab}`),
  ].filter(Boolean).join(' · ');
  const csvFilters = Object.fromEntries(Object.entries({ ...query, page: undefined, limit: undefined }).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]));
  const csvFile = `buyurtmalar_${(period ? leadPeriodText(period, now) : tashkentDay(now)).replace('–', '-')}.csv`;

  const live = (
    <span className={styles.live}>
      <RefreshCw aria-hidden />
      {t('ord.live')} · <strong>{orders.dataUpdatedAt ? tashkentClock(orders.dataUpdatedAt) : '—'}</strong>
    </span>
  );
  const csvButton = (
    <button type="button" className={styles.secondary} onClick={() => setDialog({ kind: 'csv' })} disabled={!total}>
      <Download aria-hidden />
      {t('al.csv')}
    </button>
  );
  const sectionCounts = narrowed ? totals.data?.counts ?? null : counts;
  const returnsCount = sectionCounts ? RETURN_STATUSES.reduce((sum, code) => sum + (sectionCounts[code] ?? 0), 0) : null;
  const sections = (
    <div className={styles.sections} role="tablist" aria-label={t('ord.sections')}>
      <button type="button" role="tab" className={styles.sectionTab} aria-selected>
        {t('ord.section.orders')}
        {sectionCounts ? <span className={styles.count}>{sectionCounts.ALL ?? 0}</span> : null}
      </button>
      <button type="button" role="tab" className={styles.sectionTab} aria-selected={false} onClick={() => void navigate('/admin/orders/returns')}>
        {t('ord.section.returns')}
        {returnsCount !== null ? <span className={styles.count}>{returnsCount}</span> : null}
      </button>
    </div>
  );
  const statusTabs = <OrderStatusTabs value={tab} counts={counts} warehouseLabel={admin ? undefined : 'ord.group.warehouseCancel'} onChange={(next) => update({ status: next === 'ALL' ? undefined : next })} />;
  // «Bekor qilish» ustuni (nazoratchi): Omborda — tugma; keyin — qulf va sabab; bekor qilingan — «—».
  const cancelCell = (order: OrderListItem) => (isCancelable(order.status) ? (
    <button type="button" className={styles.cancelButton} aria-label={t('ord.req.cancelAria', { id: orderNumber(order) })} onClick={(event) => { event.stopPropagation(); setDialog({ kind: 'cancel', order }); }}><Ban aria-hidden />{t('ord.menu.cancel')}</button>
  ) : order.status === 'CANCELLED' ? (
    <span className={styles.cancelNone}><span aria-hidden>—</span><span className={styles.visuallyHidden}>{t('ord.cancelCell.final')}</span></span>
  ) : (
    <span className={styles.cancelLocked}><span><Lock aria-hidden />{t('ord.cancelCell.no')}</span><span>{t(DELIVERED_LIKE.includes(order.status) ? 'ord.cancelCell.delivered' : 'ord.cancelCell.atElchi')}</span></span>
  ));
  const requests = admin ? null : (
    <CustomerRequests
      phone={phone}
      now={now}
      done={doneRequests}
      orderHref={(id) => `${base}/orders/${encodeURIComponent(id)}`}
      onCancel={(request) => request.order && setDialog({ kind: 'cancel', order: request.order, request })}
      onAddress={(request) => setDialog({ kind: 'address', orderId: request.orderId, request })}
      onClose={(request) => setDialog({ kind: 'closeRequest', request })}
    />
  );

  const loading = orders.isPending;
  const failed = orders.isError && !data;
  const noOrdersAtAll = !filtered && tab === 'ALL' && !rows.length && counts?.ALL === 0;
  // «Elchi'ga topshirildi» va «Pul o'tkazildi» bo'shligi — holat sababi bilan (davr filtri bo'lsa ham); boshqa filtrlar — umumiy.
  const onlyPeriod = !term && active.every((item) => item.key === 'period');
  const emptyKey: { title: TranslationKey; text: TranslationKey } = tab === 'HANDED_TO_ELCHI' && onlyPeriod
    ? { title: period ? 'ord.empty.handedPeriodTitle' : 'ord.empty.handedTitle', text: 'ord.empty.handedText' }
    : tab === 'REMITTED' && onlyPeriod
      ? { title: 'ord.empty.remittedTitle', text: 'ord.empty.remittedText' }
      : { title: 'ord.empty.filteredTitle', text: 'ord.empty.filteredText' };
  const clearOnlyPeriod = Boolean(period) && onlyPeriod;
  const emptyRow = !loading && !failed && !rows.length && !noOrdersAtAll ? (
    <div className={styles.message} data-testid="orders-empty">
      <span className={styles.messageIcon} aria-hidden><Search /></span>
      <span className={styles.messageText}>
        <span>{t(emptyKey.title)}</span>
        <span>{t(emptyKey.text)}</span>
      </span>
      {filtered ? (
        <button type="button" className={styles.secondarySmall} onClick={() => (clearOnlyPeriod ? update({ period: undefined }) : resetFilters())}>
          <RotateCcw aria-hidden />
          {clearOnlyPeriod ? t('ord.empty.clearPeriod') : t('al.filtersReset')}
        </button>
      ) : null}
    </div>
  ) : failed ? (
    <LoadError variant="row" error={orders.error} onRetry={() => void orders.refetch()} title={t('al.loadError')} />
  ) : null;
  const emptyBlock = (
    <div className={styles.empty} data-testid="orders-empty">
      <span className={styles.emptyIcon} aria-hidden><Package /></span>
      <p className={styles.emptyTitle}>{t('ord.empty.title')}</p>
      <p className={styles.emptyText}>{t('ord.empty.text')}</p>
      <div className={styles.emptyActions}>
        {admin ? <Link to="/admin/leads" className={styles.secondary}><Inbox aria-hidden />{t('ord.empty.toLeads')}</Link> : <Link to="/supervisor" className={styles.secondary}><ListOrdered aria-hidden />{t('ord.empty.toQueue')}</Link>}
      </div>
    </div>
  );

  const searchField = (
    <span className={styles.search}>
      <Search aria-hidden />
      <label htmlFor={searchId} className={styles.visuallyHidden}>{t('ord.search')}</label>
      <input id={searchId} type="search" value={search} placeholder={t(admin ? 'ord.searchPlaceholder' : 'ord.searchPlaceholderSup')} onChange={(event) => { setSearch(event.target.value); update({ q: event.target.value.trim() || undefined }); }} />
    </span>
  );

  return (
    <div className={styles.page} data-layout={phone ? 'phone' : undefined}>
      {phone ? (
        <>
          {admin ? sections : null}
          <div className={styles.liveRow}>
            {live}
            {admin ? (
              <button type="button" className={styles.moreButton} aria-label={t('ord.moreActions')} aria-expanded={dialog?.kind === 'actions'} onClick={() => setDialog({ kind: 'actions' })}>
                <EllipsisVertical aria-hidden />
              </button>
            ) : null}
          </div>
          {requests}
          {statusTabs}
          <div className={styles.phoneFilters} role="search" aria-label={t('ord.filters')}>
            {searchField}
            <div className={styles.chips}>
              <button type="button" className={styles.filtersButton} aria-expanded={dialog?.kind === 'filters'} onClick={() => setDialog({ kind: 'filters' })}>
                <ListFilter aria-hidden />
                {t('al.filtersButton')}
                {active.length ? <span className={styles.badge}>{active.length}</span> : null}
              </button>
              {active.map((item) => (
                <span key={item.key} className={styles.chip}>
                  {item.chip}
                  <button type="button" aria-label={t('al.filter.remove', { name: item.label })} onClick={() => update({ [item.key]: undefined })}><X aria-hidden /></button>
                </span>
              ))}
            </div>
          </div>
          {loading ? (
            <div className={styles.cardList} aria-busy="true">{[0, 1, 2].map((key) => <span key={key} className={styles.cardSkeleton} />)}</div>
          ) : failed ? emptyRow : noOrdersAtAll ? emptyBlock : !rows.length ? <div className={styles.cardList}>{emptyRow}</div> : (
            <OrderCards
              rows={rows}
              hrefOf={hrefOf}
              now={now}
              caption={caption}
              shownLabel={t(rows.length < total ? 'ord.shown' : 'ord.shownAll', { shown: rows.length, total })}
              moreLabel={t('ord.more', { count: Math.min(PHONE_STEP, total - rows.length) })}
              onMore={rows.length < total ? () => setPhoneLimit((limit) => limit + PHONE_STEP) : null}
            />
          )}
        </>
      ) : (
        <>
          {admin ? (
            <div className={styles.toolbar}>
              {sections}
              {narrow ? null : csvButton}
            </div>
          ) : null}
          {narrow ? <div className={styles.liveRow}>{live}{admin ? csvButton : null}</div> : null}
          {requests}
          <section className={styles.card} aria-label={caption}>
            {statusTabs}
            <div className={styles.filters} role="search" aria-label={t('ord.filters')}>
              {searchField}
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
                <button type="button" className={styles.ghost} onClick={resetFilters} disabled={!filtered}>
                  <RotateCcw aria-hidden />
                  {admin ? <span className={styles.wideOnly}>{t('al.filtersReset')}</span> : null}
                  <span className={admin ? styles.narrowOnly : undefined}>{t('al.reset')}</span>
                </button>
              </span>
            </div>
            {noOrdersAtAll ? emptyBlock : (
              <OrdersTable
                rows={rows}
                columns={admin ? COLUMNS : SUP_COLUMNS}
                hrefOf={hrefOf}
                now={now}
                caption={loading ? t('ord.captionLoading') : caption}
                sort={sort}
                onSort={() => update({ sort: sort === '-statusAt' ? 'statusAt' : undefined })}
                onOpen={(order) => setPanelId(order.id)}
                activeId={panelId}
                actions={(order) => <OrderRowMenu order={order} actions={admin ? ACTIONS : SUP_ACTIONS} onAction={(action) => onAction(order, action)} />}
                cancelCell={admin ? undefined : cancelCell}
                body={emptyRow}
                loading={loading}
              />
            )}
            {loading ? <p className={styles.loading} role="status"><span aria-hidden />{t('al.loading')}</p> : null}
            {total > 0 ? (
              <Pager page={page} pageSize={size} total={total} totalLabel={t('ord.pagerTotal', { total })} onPage={(next) => update({ page: next > 1 ? String(next) : undefined }, true)} onPageSize={(next) => update({ size: next === PAGE_SIZES[0] ? undefined : String(next) })} />
            ) : null}
          </section>
        </>
      )}

      <Note admin={admin} />

      {panelOrder ? (
        <OrderPanel
          order={panelOrder}
          role={role}
          href={hrefOf(panelOrder)}
          actions={admin ? ACTIONS : SUP_ACTIONS}
          onAction={(action) => onAction(panelOrder, action)}
          onClose={() => setPanelId(null)}
          canRevealPhone={admin}
          canPrintLabel={admin && !['CONFIRMED', 'PICKING', 'CANCELLED'].includes(panelOrder.status)}
          request={panelRequest}
          leadHref={panelOrder.leadId ? leadHref(panelOrder.leadId) : null}
          onCancel={admin ? undefined : () => setDialog({ kind: 'cancel', order: panelOrder, request: panelRequest?.kind === 'CANCEL' ? panelRequest : undefined })}
          onAddress={admin ? undefined : () => setDialog({ kind: 'address', orderId: panelOrder.id, request: panelRequest?.kind === 'CHANGE_ADDRESS' ? panelRequest : undefined })}
        />
      ) : null}
      {dialog?.kind === 'cancel' ? (
        <CancelOrderDialog order={dialog.order} role={role} request={dialog.request ?? null} onClose={() => setDialog(null)} onDone={dialog.request ? () => dialog.request && markDone(dialog.request) : undefined} />
      ) : null}
      {dialog?.kind === 'address' ? (
        <AddressDialogFor orderId={dialog.orderId} role={role} request={dialog.request ?? null} onClose={() => setDialog(null)} onDone={dialog.request ? () => dialog.request && markDone(dialog.request) : undefined} />
      ) : null}
      {dialog?.kind === 'closeRequest' ? <CloseRequestDialog request={dialog.request} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'label' ? <OrderLabelDialog order={dialog.order} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'csv' ? (
        <CsvExportDialog
          title={t('ord.csv.title')}
          summary={csvSummary}
          countLabel={t('ord.csv.count', { count: total })}
          columns={ORDER_EXPORT_COLUMNS.map((key) => ({ key, label: t(`ord.csv.col.${key}`) }))}
          defaultColumns={ORDER_EXPORT_COLUMNS.filter((key) => key !== 'priceSnapshot' && key !== 'subs')}
          phoneColumn="phone"
          phoneExample="****6619"
          fileName={csvFile}
          onExport={({ columns, phone: mode }) => exportOrders({ filters: csvFilters, columns, phone: mode })}
          onClose={() => setDialog(null)}
          testId="orders-csv-dialog"
        />
      ) : null}
      {dialog?.kind === 'actions' ? (
        <Dialog open title={t('ord.actionsTitle')} icon={<EllipsisVertical />} onClose={() => setDialog(null)}>
          <ul className={styles.sheetMenu} role="menu">
            <li role="none">
              <button type="button" role="menuitem" disabled={!total} onClick={() => setDialog({ kind: 'csv' })}><Download aria-hidden />{t('al.csv')}</button>
            </li>
          </ul>
          <p className={styles.hint}><Info aria-hidden />{t('ord.actionsNote')}</p>
        </Dialog>
      ) : null}
      {dialog?.kind === 'filters' ? (
        <Dialog
          open
          title={t('al.filtersButton')}
          icon={<ListFilter />}
          onClose={() => setDialog(null)}
          footer={(
            <>
              <DialogCancel onClick={() => update(Object.fromEntries(filters.map((item) => [item.key, undefined])))}>{t('al.reset')}</DialogCancel>
              <button type="button" className={styles.barPrimary} onClick={() => setDialog(null)}>{t('ord.filtersApply', { count: total })}</button>
            </>
          )}
        >
          {filters.map((item) => (
            <SheetSelect key={item.key} label={item.label} value={item.value} options={item.options} hint={item.hint} onChange={(value) => update({ [item.key]: value || undefined })} />
          ))}
        </Dialog>
      ) : null}
    </div>
  );
}

/** Sahifa izohi: «Omborda» — bekor qilsa bo'ladi; «Elchi'da» va keyingilar — Elchi webhooki va moliya. */
function Note({ admin }: { admin: boolean }) {
  const { t } = useTranslation();
  const strong = (key: 'warehouse' | 'elchi'): ReactNode => <strong>{t(`ord.group.${key}`)}</strong>;
  if (!admin) return <p className={styles.note}>{rich(t('ord.noteSup'), { warehouse: strong('warehouse'), handed: <strong>{t('ord.noteSupHanded')}</strong> })}</p>;
  return <p className={styles.note}>{rich(t('ord.note'), { warehouse: strong('warehouse'), elchi: strong('elchi') })}</p>;
}

function SheetSelect({ label, value, options, hint, onChange }: { label: string; value: string; options: readonly PillOption[]; hint?: string; onChange: (value: string) => void }) {
  const id = useId();
  const hintId = useId();
  return (
    <div className={styles.sheetField}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.sheetSelect}>
        <select id={id} value={value} aria-describedby={hint ? hintId : undefined} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden />
      </span>
      {hint ? <p id={hintId} className={styles.sheetHint}>{hint}</p> : null}
    </div>
  );
}
