import { ArrowRightLeft, Calendar, ChevronDown, ChevronRight, Download, Ellipsis, Inbox, Info, Link as LinkIcon, ListChecks, ListFilter, RefreshCw, RotateCcw, Search, Shield, TriangleAlert, X } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminLeadsQuery, useLeadFilterOptionsQuery } from '../../features/adminLeads/api/adminLeadsQueries';
import {
  isPhoneSearch,
  isScheduledCall,
  LEAD_PERIODS,
  leadPeriodRange,
  leadPeriodText,
  parseLeadPeriod,
  parseLeadTab,
  parseSort,
  transferBlock,
  type LeadPeriod,
  type SortField,
} from '../../features/adminLeads/lib/leadRows';
import { LEAD_TAB_STATUSES, LEAD_TABS, type AdminLeadListItem, type AdminLeadQuery, type LeadTab } from '../../features/adminLeads/model/adminLeadTypes';
import { ReopenDialog } from '../../features/adminLeads/ui/ReopenDialog';
import { TransferDialog } from '../../features/adminLeads/ui/TransferDialog';
import { useCurrentUserQuery } from '../../features/auth/api/useCurrentUserQuery';
import type { LeadStatus } from '../../features/operator/model/operatorTypes';
import { rich } from '../../shared/i18n/richText';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatUzPhone } from '../../shared/lib/phone';
import { tashkentClock, tashkentDay } from '../../shared/lib/tashkentTime';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { useNow } from '../../shared/lib/useNow';
import { Dialog, DialogCancel } from '../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePageStatus } from '../../shared/ui/PageHeader/pageTitle';
import { Pager } from '../../shared/ui/Pager/Pager';
import { PAGE_SIZES } from '../../shared/ui/Pager/pagerItems';
import { PillSelect, type PillOption } from '../../shared/ui/PillSelect/PillSelect';
import { statusKey } from '../../shared/ui/StatusBadge/statusConfig';
import { CsvDialog } from './components/CsvDialog';
import { LeadCards } from './components/LeadCards';
import { LeadsTable, MessageRow, type LeadRowAction } from './components/LeadsTable';
import styles from './AdminLeadsPage.module.css';

const ALL_STATUSES: readonly LeadStatus[] = ['NEW', 'BOOKED', 'CALLBACK', 'CONFIRMED', 'REJECTED', 'INVALID', 'MERGED', 'NO_CONTACT'];
const SOURCES = ['LANDING', 'SITE', 'API'] as const;
const PHONE_STEP = 10;
const FILTER_KEYS = ['q', 'status', 'product', 'operator', 'affiliate', 'source', 'period'] as const;

type DialogState =
  | { kind: 'transfer'; leads: AdminLeadListItem[] }
  | { kind: 'reopen'; lead: AdminLeadListItem }
  | { kind: 'csv' }
  | { kind: 'actions' }
  | { kind: 'filters' }
  | null;

/**
 * «Lidlar» (FE-26, admin-lidlar; BE-13/BE-35/BE-42): holat yorliqlari va sonlari, «Tekshiruvda» banneri (admin),
 * qidiruv va 6 filtr (nazoratchida «Manba» yo'q), tanlash va ommaviy o'tkazish, jadval, sahifalash, real vaqt.
 * Telefon raqami niqoblangan; telefon bo'yicha qidiruv, CSV va qayta ochish — faqat admin.
 */
export default function AdminLeadsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useCurrentUserQuery().data?.role;
  const admin = role === 'ADMIN' || role === 'SUPERADMIN';
  const base = admin ? '/admin/leads' : '/supervisor/leads';
  const phone = useMediaQuery('(max-width: 767.98px)');
  // Planshet va telefonda yuqori qatorda sahifa holati yo'q — «Real vaqtda yangilanadi» sahifaning o'zida.
  const narrow = useMediaQuery('(max-width: 1023.98px)');
  const now = useNow();
  const searchId = useId();
  const [params, setParams] = useSearchParams();

  const rawTab = parseLeadTab(params.get('tab'));
  const tab: LeadTab = !admin && rawTab === 'REVIEW' ? 'ALL' : rawTab;
  const tabStatuses = tab === 'ALL' || tab === 'REVIEW' ? ALL_STATUSES : LEAD_TAB_STATUSES[tab];
  const statusParam = params.get('status') as LeadStatus | null;
  const status = statusParam && tabStatuses.includes(statusParam) ? statusParam : '';
  const productId = params.get('product') ?? '';
  const operatorId = params.get('operator') ?? '';
  const affiliateId = params.get('affiliate') ?? '';
  const source = admin && (SOURCES as readonly string[]).includes(params.get('source') ?? '') ? params.get('source') ?? '' : '';
  const period = parseLeadPeriod(params.get('period'));
  const sort = parseSort(params.get('sort'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const size = (PAGE_SIZES as readonly number[]).includes(Number(params.get('size'))) ? Number(params.get('size')) : PAGE_SIZES[0];

  const [search, setSearch] = useState(params.get('q') ?? '');
  const term = useDebouncedValue(search.trim(), 300);
  const phoneSearch = admin && isPhoneSearch(term);
  const [phoneLimit, setPhoneLimit] = useState(PHONE_STEP);
  const [selected, setSelected] = useState<ReadonlyMap<string, AdminLeadListItem>>(new Map());
  const [selecting, setSelecting] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);

  // Telefon bo'yicha qidiruvda davr «Hamma vaqt» (admin-lidlar holatlar).
  const range = period && !phoneSearch ? leadPeriodRange(period) : null;
  const query: AdminLeadQuery = {
    tab,
    ...(term ? { search: term } : {}),
    ...(status ? { status } : {}),
    ...(productId ? { productId } : {}),
    ...(operatorId ? { operatorId } : {}),
    ...(affiliateId ? { affiliateId } : {}),
    ...(source ? { source } : {}),
    ...(range ? { from: range.from, to: range.to } : {}),
    sort,
    page: phone ? 1 : page,
    limit: phone ? phoneLimit : size,
  };
  const leads = useAdminLeadsQuery(query);
  const options = useLeadFilterOptionsQuery(admin);
  const data = leads.data;
  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const counts = data?.counts ?? null;

  usePageStatus(narrow ? null : t('al.live'), narrow || !leads.dataUpdatedAt ? null : tashkentClock(leads.dataUpdatedAt));

  // Joriy manzildan (ketma-ket ikki o'zgarishda birinchisi yo'qolmasin); filtr o'zgarsa — 1-sahifa, tanlov tozalanadi.
  const update = (patch: Record<string, string | undefined>, keepPage = false) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!keepPage) next.delete('page');
    setParams(next, { replace: true });
    if (!keepPage) {
      setSelected(new Map());
      setPhoneLimit(PHONE_STEP);
    }
  };
  const resetFilters = () => {
    setSearch('');
    update(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])));
  };
  const onSort = (field: SortField) => {
    const current = sort.replace('-', '');
    const next = current === field ? (sort.startsWith('-') ? field : `-${field}`) : `-${field}`;
    update({ sort: next === '-createdAt' ? undefined : next });
  };
  const onSelect = (ids: readonly string[], checked: boolean) => {
    const next = new Map(selected);
    for (const id of ids) {
      const lead = rows.find((row) => row.id === id);
      if (checked && lead) next.set(id, lead);
      else next.delete(id);
    }
    setSelected(next);
  };
  const clearSelection = () => {
    setSelected(new Map());
    setSelecting(false);
  };
  const onAction = (action: LeadRowAction, lead: AdminLeadListItem) => setDialog(action === 'transfer' ? { kind: 'transfer', leads: [lead] } : { kind: 'reopen', lead });

  // ── Filtr variantlari ──
  const all = t('al.filter.all');
  const productOptions: PillOption[] = [{ value: '', label: all }, ...(options.data?.products ?? []).map((item) => ({ value: item.id, label: item.name }))];
  const operatorOptions: PillOption[] = [{ value: '', label: all }, ...(options.data?.operators ?? []).map((item) => ({ value: item.id, label: item.name }))];
  const affiliateOptions: PillOption[] = [{ value: '', label: all }, ...(options.data?.affiliates ?? []).map((item) => ({ value: item.id, label: item.name }))];
  const statusOptions: PillOption[] = [{ value: '', label: all }, ...tabStatuses.map((code) => ({ value: code, label: t(statusKey('lead', code)) }))];
  const sourceOptions: PillOption[] = [{ value: '', label: all }, ...SOURCES.map((code) => ({ value: code, label: t(`al.source.${code}`) }))];
  const periodLabel = (value: LeadPeriod) => t(`al.period.${value}`, { range: leadPeriodText(value, now) });
  const periodOptions: PillOption[] = [{ value: '', label: t('al.period.all') }, ...LEAD_PERIODS.map((value) => ({ value, label: periodLabel(value) }))];
  const nameOf = (list: PillOption[], value: string) => list.find((item) => item.value === value)?.label ?? value;

  const filters: Array<{ key: (typeof FILTER_KEYS)[number]; label: string; value: string; options: PillOption[]; chip: string; icon?: typeof Calendar }> = [
    { key: 'product', label: t('al.filter.product'), value: productId, options: productOptions, chip: nameOf(productOptions, productId) },
    { key: 'status', label: t('al.filter.status'), value: status, options: statusOptions, chip: status ? t(statusKey('lead', status)) : '' },
    { key: 'operator', label: t('al.filter.operator'), value: operatorId, options: operatorOptions, chip: nameOf(operatorOptions, operatorId) },
    { key: 'affiliate', label: t('al.filter.affiliate'), value: affiliateId, options: affiliateOptions, chip: nameOf(affiliateOptions, affiliateId) },
    ...(admin ? [{ key: 'source' as const, label: t('al.filter.source'), value: source, options: sourceOptions, chip: source ? t(`al.source.${source as (typeof SOURCES)[number]}`) : '' }] : []),
    { key: 'period', label: t('al.filter.period'), value: period && !phoneSearch ? period : '', options: periodOptions, chip: period ? leadPeriodText(period, now) : '', icon: Calendar },
  ];
  const active = filters.filter((item) => item.value);
  const filtered = Boolean(term) || active.length > 0;

  // Jadval nomi va CSV dagi «joriy filtrlar»: «Simsiz quloqchinlar, 08.01–14.01.2027».
  const summaryParts = active.map((item) => item.chip);
  const caption = phoneSearch ? t('al.captionPhone') : summaryParts.length ? t('al.captionFiltered', { filters: summaryParts.join(', ') }) : t('al.caption');
  const csvSummary = [
    nameOf(productOptions, productId) === all ? null : nameOf(productOptions, productId),
    period ? leadPeriodText(period, now) : t('al.allTime'),
    status ? t(statusKey('lead', status)) : t('al.allStatuses'),
  ].filter(Boolean).join(' · ');
  const csvFilters = Object.fromEntries(Object.entries({ ...query, page: undefined, limit: undefined }).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]));
  const csvFile = `lidlar_${(period ? leadPeriodText(period, now) : tashkentDay(now)).replace('–', '-')}.csv`;

  // ── Tanlov: o'tkazsa bo'ladiganlari; hammasi bitta operatordagi rejalashtirilgan qo'ng'iroq bo'lsa — izoh ──
  const picked = [...selected.values()];
  const movable = picked.filter((lead) => !transferBlock(lead));
  const owner = movable.length && movable.every((lead) => lead.operatorName && lead.operatorName === movable[0].operatorName && isScheduledCall(lead, now)) ? movable[0].operatorName : null;
  const selectionNote = movable.length < picked.length
    ? t('al.selectedBlocked', { count: picked.length - movable.length })
    : owner ? t(picked.length === 2 ? 'al.selectedBoth' : 'al.selectedAll', { operator: owner }) : null;
  const openTransfer = () => movable.length && setDialog({ kind: 'transfer', leads: movable });

  const live = (
    <span className={styles.live}>
      <RefreshCw aria-hidden />
      {t('al.live')} · <strong>{leads.dataUpdatedAt ? tashkentClock(leads.dataUpdatedAt) : '—'}</strong>
    </span>
  );
  const csvButton = admin ? (
    <button type="button" className={styles.secondary} onClick={() => setDialog({ kind: 'csv' })} disabled={!total}>
      <Download aria-hidden />
      {t('al.csv')}
    </button>
  ) : null;

  const mainTabs = LEAD_TABS.filter((key) => key !== 'REVIEW');
  const tabButton = (key: LeadTab) => (
    <button key={key} type="button" role="tab" className={styles.tab} aria-selected={tab === key} onClick={() => update({ tab: key === 'ALL' ? undefined : key, status: undefined })}>
      {t(`al.tab.${key}`)}
      {counts ? <span className={styles.count}>{counts[key] ?? 0}</span> : null}
    </button>
  );
  const tabs = (
    <div className={styles.tabs} role="tablist" aria-label={t('al.tabs')}>
      <div className={styles.tabScroll}>{mainTabs.map(tabButton)}</div>
      {admin ? (
        <>
          <span className={styles.tabDivider} aria-hidden />
          {tabButton('REVIEW')}
        </>
      ) : null}
    </div>
  );

  const review = admin && data?.review && data.review.count > 0 && tab !== 'REVIEW' ? data.review : null;
  const noLeadsAtAll = !filtered && tab === 'ALL' && !rows.length && counts?.ALL === 0;
  const loading = leads.isPending;
  const failed = leads.isError && !data;
  const emptyFiltered = !loading && !failed && !rows.length && !noLeadsAtAll;
  const noContactToday = status === 'NO_CONTACT' && period === 'today';
  const emptyRow = emptyFiltered ? (
    <MessageRow
      title={t('al.noResults')}
      text={t(noContactToday ? 'al.noResultsNoContact' : 'al.noResultsText')}
      action={filtered ? <button type="button" className={styles.secondarySmall} onClick={resetFilters}>{t('al.reset')}</button> : null}
    />
  ) : failed ? (
    <LoadError variant="row" error={leads.error} onRetry={() => void leads.refetch()} title={t('al.loadError')} />
  ) : null;
  const phoneNumber = phoneSearch ? formatUzPhone(term) : null;

  const emptyBlock = (
    <div className={styles.empty} data-testid="leads-empty">
      <span className={styles.emptyIcon} aria-hidden><Inbox /></span>
      <p className={styles.emptyTitle}>{t('al.emptyTitle')}</p>
      <p className={styles.emptyText}>{t('al.emptyText')}</p>
      {admin ? (
        <div className={styles.emptyActions}>
          <Link to="/admin/sellers" className={styles.secondary}><LinkIcon aria-hidden />{t('al.emptyPages')}</Link>
        </div>
      ) : null}
    </div>
  );

  const selectionBar = picked.length ? (
    <div className={styles.selection} data-testid="lead-selection">
      <span className={styles.selectionText}>
        <span>{t('al.selected', { count: picked.length })}</span>
        {selectionNote ? <span>{selectionNote}</span> : null}
      </span>
      {phone ? null : (
        <>
          <span className={styles.selectionDivider} aria-hidden />
          <button type="button" className={styles.outline} onClick={openTransfer} disabled={!movable.length}>
            <ArrowRightLeft aria-hidden />
            {t('al.transfer')}
          </button>
        </>
      )}
      <span className={styles.selectionEnd}>
        <button type="button" className={styles.ghost} onClick={clearSelection}>
          <span className={styles.wideOnly}>{t('al.clearSelection')}</span>
          <span className={styles.narrowOnly}>{t('al.cancel')}</span>
        </button>
      </span>
    </div>
  ) : null;

  const searchField = (
    <span className={styles.search}>
      <Search aria-hidden />
      <label htmlFor={searchId} className={styles.visuallyHidden}>{t('al.search')}</label>
      <input
        id={searchId}
        type="search"
        value={search}
        placeholder={t(phone ? (admin ? 'al.searchPlaceholderPhone' : 'al.searchPlaceholderSup') : admin ? 'al.searchPlaceholder' : 'al.searchPlaceholderSup')}
        onChange={(event) => { setSearch(event.target.value); update({ q: event.target.value.trim() || undefined }); }}
      />
    </span>
  );

  const pager = !phone && total > 0 ? (
    <Pager page={page} pageSize={size} total={total} totalLabel={t('al.pagerTotal', { total })} onPage={(next) => update({ page: next > 1 ? String(next) : undefined }, true)} onPageSize={(next) => update({ size: next === PAGE_SIZES[0] ? undefined : String(next) })} />
  ) : null;

  return (
    <div className={styles.page} data-layout={phone ? 'phone' : undefined} data-role={admin ? 'admin' : 'supervisor'}>
      {review ? (
        <div className={styles.banner} role="status" data-tone="warning">
          <TriangleAlert aria-hidden />
          <div>
            <p className={styles.bannerTitle}>{t('al.reviewTitle', { count: review.count })}</p>
            <p>{t('al.reviewText', { count: review.count, stream: review.streamCode, affiliate: review.affiliateName, from: tashkentClock(Date.parse(review.from)), to: tashkentClock(Date.parse(review.to)) })}</p>
            <button type="button" className={styles.bannerLink} onClick={() => update({ tab: 'REVIEW', status: undefined })}>{t('al.reviewOpen')}</button>
          </div>
        </div>
      ) : null}
      {!admin ? (
        <div className={styles.banner} role="note" data-tone="neutral">
          <Info aria-hidden />
          <div>
            <p className={styles.bannerTitle}>{t('al.supTitle')}</p>
            <p>{t('al.supText')}</p>
          </div>
        </div>
      ) : null}

      {phone ? (
        <div className={styles.liveRow}>
          {live}
          {admin ? (
            <button type="button" className={styles.moreButton} aria-label={t('al.moreActions')} aria-expanded={dialog?.kind === 'actions'} onClick={() => setDialog({ kind: 'actions' })}>
              <Ellipsis aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={styles.toolbar}>
        {tabs}
        {narrow ? null : csvButton}
      </div>
      {narrow && !phone ? <div className={styles.liveRow}>{live}{csvButton}</div> : null}

      {phone ? (
        <div className={styles.phoneFilters}>
          <div className={styles.phoneSearchRow} role="search" aria-label={t('al.filters')}>
            {searchField}
            <button type="button" className={styles.filtersButton} aria-expanded={dialog?.kind === 'filters'} onClick={() => setDialog({ kind: 'filters' })}>
              <ListFilter aria-hidden />
              {t('al.filtersButton')}
              {active.length ? <span className={styles.badge}>{active.length}</span> : null}
            </button>
          </div>
          {active.length ? (
            <div className={styles.chips}>
              {active.map((item) => (
                <span key={item.key} className={styles.chip}>
                  {item.chip}
                  <button type="button" aria-label={t('al.filter.remove', { name: item.label })} onClick={() => update({ [item.key]: undefined })}><X aria-hidden /></button>
                </span>
              ))}
            </div>
          ) : null}
          {selectionBar}
          {loading ? (
            <div className={styles.cardList} aria-busy="true">{[0, 1, 2].map((key) => <span key={key} className={styles.cardSkeleton} />)}</div>
          ) : failed ? (
            <LoadError variant="row" error={leads.error} onRetry={() => void leads.refetch()} title={t('al.loadError')} />
          ) : noLeadsAtAll ? emptyBlock : !rows.length ? (
            <div className={styles.cardList}>{emptyRow}</div>
          ) : (
            <LeadCards
              rows={rows}
              base={base}
              now={now}
              caption={caption}
              selecting={selecting}
              selected={new Set(selected.keys())}
              onSelect={onSelect}
              total={total}
              moreCount={Math.min(PHONE_STEP, total - rows.length)}
              onMore={rows.length < total ? () => setPhoneLimit((limit) => limit + PHONE_STEP) : null}
            />
          )}
        </div>
      ) : (
        <section className={styles.card} aria-label={caption}>
          <div className={styles.filters} role="search" aria-label={t('al.filters')}>
            {searchField}
            {filters.map((item) => (
              <PillSelect
                key={item.key}
                className={styles.pill}
                label={item.label}
                value={item.value}
                options={item.options}
                icon={item.icon}
                disabled={item.key === 'period' && phoneSearch}
                onChange={(value) => update({ [item.key]: value || undefined })}
                onClear={() => update({ [item.key]: undefined })}
                clearLabel={t('al.filter.clear', { name: item.label })}
              />
            ))}
            <span className={styles.filtersEnd}>
              <button type="button" className={styles.ghost} onClick={resetFilters} disabled={!filtered}>
                <RotateCcw aria-hidden />
                <span className={styles.wideOnly}>{t('al.filtersReset')}</span>
                <span className={styles.narrowOnly}>{t('al.reset')}</span>
              </button>
            </span>
          </div>
          {selectionBar}
          {phoneNumber && rows.length ? (
            <div className={styles.phoneResult}>
              <p>{rich(t('al.phoneResult', { count: total }), { phone: <strong>{phoneNumber}</strong> })}</p>
              <Link to={`/admin/orders?q=${encodeURIComponent(term)}`} className={styles.textLink}>{t('al.customerHistory')}<ChevronRight aria-hidden /></Link>
            </div>
          ) : null}
          {noLeadsAtAll ? emptyBlock : (
            <LeadsTable
              rows={rows}
              base={base}
              admin={admin}
              now={now}
              caption={loading ? t('al.captionLoading') : caption}
              phoneColumn={phoneNumber}
              sort={sort}
              onSort={onSort}
              selected={new Set(selected.keys())}
              onSelect={onSelect}
              onAction={onAction}
              body={emptyRow}
              loading={loading}
            />
          )}
          {loading ? <p className={styles.loading} role="status"><span aria-hidden />{t('al.loading')}</p> : null}
          {phoneNumber ? <p className={styles.hint}><Shield aria-hidden />{t('al.phoneNote')}</p> : null}
          {pager}
        </section>
      )}

      {admin ? <Note /> : null}

      {phone && selecting ? (
        <PageActionBar>
          <button type="button" className={styles.barPrimary} onClick={openTransfer} disabled={!movable.length}>
            <ArrowRightLeft aria-hidden />
            {t('al.transfer')}
          </button>
        </PageActionBar>
      ) : null}

      {dialog?.kind === 'transfer' ? (
        <TransferDialog
          leads={dialog.leads}
          onClose={() => setDialog(null)}
          onDone={(moved) => {
            const next = new Map(selected);
            moved.forEach((id) => next.delete(id));
            setSelected(next);
            if (!next.size) setSelecting(false);
          }}
        />
      ) : null}
      {dialog?.kind === 'reopen' ? <ReopenDialog lead={dialog.lead} onClose={() => setDialog(null)} onOpenLead={(id) => void navigate(`${base}/${encodeURIComponent(id)}`)} /> : null}
      {dialog?.kind === 'csv' ? <CsvDialog summary={csvSummary} count={total} filters={csvFilters} fileName={csvFile} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'actions' ? (
        <Dialog open title={t('al.actionsTitle')} icon={<Ellipsis />} onClose={() => setDialog(null)}>
          <ul className={styles.sheetMenu} role="menu">
            <li role="none">
              <button type="button" role="menuitem" onClick={() => { setSelecting(true); setDialog(null); }}><ListChecks aria-hidden />{t('al.selectMode')}</button>
            </li>
            <li role="none">
              <button type="button" role="menuitem" disabled={!total} onClick={() => setDialog({ kind: 'csv' })}><Download aria-hidden />{t('al.csv')}</button>
            </li>
          </ul>
          <p className={styles.hint}><Info aria-hidden />{t('al.actionsNote')}</p>
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
              <button type="button" className={styles.barPrimary} onClick={() => setDialog(null)}>{t('al.filtersApply', { count: total })}</button>
            </>
          )}
        >
          {filters.map((item) => (
            <SheetSelect key={item.key} label={item.label} value={item.value} options={item.options} disabled={item.key === 'period' && phoneSearch} onChange={(value) => update({ [item.key]: value || undefined })} />
          ))}
        </Dialog>
      ) : null}
    </div>
  );
}

/** Sahifa izohi: «Ishda», «Yopilgan» va «Tekshiruvda» nimani bildiradi (admin-lidlar pasti). */
function Note() {
  const { t } = useTranslation();
  const strong = (key: 'ACTIVE' | 'CLOSED' | 'REVIEW'): ReactNode => <strong>{t(`al.tab.${key}`)}</strong>;
  return <p className={styles.note}>{rich(t('al.note'), { active: strong('ACTIVE'), closed: strong('CLOSED'), review: strong('REVIEW') })}</p>;
}

function SheetSelect({ label, value, options, disabled, onChange }: { label: string; value: string; options: readonly PillOption[]; disabled?: boolean; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className={styles.sheetField}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.sheetSelect}>
        <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden />
      </span>
    </div>
  );
}
