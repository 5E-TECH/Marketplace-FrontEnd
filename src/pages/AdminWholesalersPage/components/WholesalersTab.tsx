import { Building2, ChevronDown, EllipsisVertical, ListFilter, PackagePlus, Plus, RotateCcw, Search } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useWholesalerAttentionQuery, useWholesalersQuery } from '../../../features/wholesalers/api/wholesalersQueries';
import { inTab, matchesFilters, tabCounts } from '../../../features/wholesalers/lib/wholesalerRules';
import { WHOLESALER_TABS, type Wholesaler } from '../../../features/wholesalers/model/wholesalerTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { rich } from '../../../shared/i18n/richText';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel } from '../../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { PillSelect, type PillOption } from '../../../shared/ui/PillSelect/PillSelect';
import { cardPath, codeList, parseCabinet, parseContract, parseStatusTab, wholesalerKpis } from '../model/wholesalerList';
import { AttentionCard, LaunchSteps } from './WholesalerOverview';
import { WholesalerCards, WholesalerTable, type WholesalerAction } from './WholesalerTable';
import styles from './WholesalersTab.module.css';

interface WholesalersTabProps {
  phone: boolean;
  /** «Postavka arizasi» — «Postavkalar» yorlig'idagi e'lon formasi (optovik tanlangan bo'lsa — shu optovik nomidan). */
  onDeclare: (wholesalerId?: string) => void;
  /** «Yangi arizalar»: faqat «Tekshiruvda» (M2) — KPI, diqqat va qadamlarsiz. */
  applications?: boolean;
}

/**
 * «Optoviklar» yorlig'i (FE-25, admin-optoviklar + .planshet/.mobil/.holatlar): 4 ko'rsatkich, ro'yxat (holat
 * yorliqlari, nom/STIR qidiruvi, «Shartnoma» va «Kabinet» filtrlari URL da), «Diqqat talab qiladi», ishga tushish
 * qadamlari. Yig'ma raqamlar — taklif `stats` (fe-25 §4); filtrlar brauzerda (pilotda optovik o'nlab).
 */
export function WholesalersTab({ phone, onDeclare, applications = false }: WholesalersTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = useWholesalersQuery();
  const attention = useWholesalerAttentionQuery();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchId = useId();

  const status = applications ? 'PENDING' : parseStatusTab(params.get('status'));
  const contract = parseContract(params.get('contract'));
  const cabinet = parseCabinet(params.get('cabinet'));
  const search = params.get('q') ?? '';
  // Joriy manzildan (hook qiymati render paytidagi — ketma-ket ikki o'zgarishda birinchisi yo'qolardi).
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const resetFilters = () => update({ q: null, contract: null, cabinet: null });

  const all = query.data ?? [];
  const filtered = all.filter((item) => matchesFilters(item, { search, contract, cabinet }));
  const rows = filtered.filter((item) => inTab(item, status));
  const counts = tabCounts(filtered);
  const hasFilters = Boolean(search.trim() || contract || cabinet);
  const time = query.dataUpdatedAt ? tashkentClock(query.dataUpdatedAt) : '—';

  const onAction = (item: Wholesaler, action: WholesalerAction) => {
    if (action === 'open') void navigate(cardPath(item.id));
    else if (action === 'declare') onDeclare(item.id);
    else if (action === 'addProduct') void navigate(`/admin/products/new?wholesaler=${encodeURIComponent(item.id)}`);
    else void navigate(`${cardPath(item.id)}?dialog=${action}`);
  };

  const anyOption = { value: '', label: t('whs.filter.all') };
  const contractOptions: PillOption[] = [anyOption, ...(['SIGNED', 'MISSING'] as const).map((value) => ({ value, label: t(`whs.filter.contract.${value}`) }))];
  const cabinetOptions: PillOption[] = [anyOption, ...(['ACTIVE', 'INVITED', 'NONE'] as const).map((value) => ({ value, label: t(`whs.filter.cabinet.${value}`) }))];

  const searchBox = (
    <span className={styles.search}>
      <Search aria-hidden />
      <label htmlFor={searchId} className={styles.visuallyHidden}>{t('whs.searchAria')}</label>
      <input id={searchId} type="search" value={search} placeholder={t('whs.search')} onChange={(event) => update({ q: event.target.value || null })} />
    </span>
  );

  const statusTabs = applications ? null : (
    <div className={styles.tabs} role="tablist" aria-label={t('whs.statusTabs')}>
      {WHOLESALER_TABS.map((key) => (
        <button key={key} type="button" role="tab" className={styles.tab} aria-selected={status === key} onClick={() => update({ status: key === 'ALL' ? null : key })}>
          {t(`whs.tab.${key}`)}
          <span className={styles.count}>{counts[key]}</span>
        </button>
      ))}
    </div>
  );

  const filterDescription = [
    search.trim() ? `«${search.trim()}»` : null,
    contract ? t(`whs.fdesc.${contract}`) : null,
    cabinet ? t(`whs.fdesc.${cabinet}`) : null,
  ].filter(Boolean).join(', ');
  const what = t(contract ? `whs.what.${contract}` : 'whs.what.any');
  const emptyRow = (
    <span className={styles.emptyRow}>
      <Search aria-hidden />
      <span>{search.trim() ? t('whs.noResults', { query: search.trim(), what }) : t('whs.noResultsPlain', { what })}</span>
      {hasFilters ? <button type="button" className={styles.linkButton} onClick={resetFilters}>{t('whs.filtersReset')}</button> : null}
    </span>
  );

  const footer = (
    <div className={styles.footer}>
      <span>{hasFilters ? t('whs.footerFiltered', { count: rows.length, filters: filterDescription }) : t('whs.footer', { count: rows.length })}</span>
      {rows.length ? (
        <>
          <span className={styles.desktopOnly}>{t(rows.some((item) => item.status === 'PENDING') && !applications ? 'whs.footerHintPending' : 'whs.footerHint')}</span>
          <span className={styles.tabletOnly}>{t('whs.footerHintTablet')}</span>
        </>
      ) : null}
    </div>
  );

  // Hali birorta optovik yo'q (pilotdan oldin): yagona amal — «Optovik qo'shish», bo'sh holat ichida.
  const noneYet = query.isSuccess && all.length === 0;

  const listBody = (): ReactNode => {
    if (query.isError) return null;
    if (query.isPending) {
      return (
        <div className={styles.tableWrap} aria-busy="true" data-testid="wholesalers-loading">
          <table className={styles.table}>
            <thead><Header /></thead>
            <tbody>
              {[0, 1, 2].map((index) => (
                <tr key={index} className={styles.skeletonRow}>
                  {Array.from({ length: 8 }, (_, cell) => (
                    <td key={cell} data-wide={[2, 3, 5].includes(cell) || undefined} data-end={[4, 6].includes(cell) || undefined} data-kind={cell === 1 || cell === 2 ? 'pill' : cell === 7 ? 'dot' : undefined}>
                      <span /><span />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (noneYet || (applications && !rows.length && !hasFilters)) {
      return (
        <div className={styles.tableWrap}>
          {phone ? null : <table className={styles.table}><thead><Header /></thead></table>}
          <div className={styles.empty} data-testid="wholesalers-empty">
            <span className={styles.emptyIcon} aria-hidden><Building2 /></span>
            <h3>{t(applications ? 'whs.apps.emptyTitle' : 'whs.emptyTitle')}</h3>
            <p>{t(applications ? 'whs.apps.emptyText' : 'whs.emptyText')}</p>
            {applications ? null : <Link to="/admin/wholesalers/new" className={styles.primary}><Plus aria-hidden />{t('whs.add')}</Link>}
          </div>
        </div>
      );
    }
    if (phone) {
      return rows.length
        ? <WholesalerCards rows={rows} footer={<p className={styles.cardsFooter} role="status">{t('whs.footerPhone', { count: rows.length })}</p>} />
        : <div className={styles.cardsBox}><div className={styles.cardsEmpty}>{emptyRow}</div></div>;
    }
    return <WholesalerTable rows={rows} onAction={onAction} empty={rows.length ? null : emptyRow} footer={footer} />;
  };

  const kpis = wholesalerKpis(all);
  const showOverview = !applications && query.isSuccess && all.length > 0;
  const money = (value: number) => formatMoney(value);

  return (
    <>
      {showOverview && phone ? (
        <div className={styles.phoneHead}>
          <p>{rich(t('whs.list.asOfPhone'), { time: <strong>{time}</strong> })}</p>
          <button type="button" className={styles.phoneMenu} aria-label={t('whs.pageMenu')} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><EllipsisVertical aria-hidden /></button>
        </div>
      ) : null}

      {showOverview ? (
        <div className={styles.kpis} data-testid="wholesaler-kpis">
          <Kpi label={t('whs.kpi.wholesalers')} value={String(kpis.working)} unit={t('whs.kpi.wholesalersUnit')} sub={t('whs.kpi.wholesalersSub')} />
          <Kpi label={t('whs.kpi.stock')} value={kpis.stock ? money(kpis.stock.onHand) : '—'} unit={kpis.stock ? t('whs.kpi.stockUnit') : ''} sub={kpis.stock ? t('whs.kpi.stockSub', { available: money(kpis.stock.available), reserved: money(kpis.stock.reserved) }) : ''} />
          <Kpi
            label={t('whs.kpi.waiting')}
            value={kpis.waiting ? String(kpis.waiting.count) : '—'}
            unit={kpis.waiting ? t('whs.kpi.waitingUnit') : ''}
            sub={kpis.waiting ? (kpis.waiting.count ? t('whs.kpi.waitingSub', { qty: money(kpis.waiting.qty), codes: codeList(kpis.waiting.codes) }) : t('whs.kpi.waitingNone')) : ''}
            wide
          />
          <Kpi label={t('whs.kpi.payable')} value={kpis.payable ? money(kpis.payable.amount) : '—'} unit={kpis.payable ? t('whs.kpi.payableUnit') : ''} sub={kpis.payable ? t('whs.kpi.payableSub', { amount: money(kpis.payable.held) }) : ''} wide />
        </div>
      ) : null}

      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} lastSuccessAt={query.dataUpdatedAt} variant="page" context={t(applications ? 'whs.apps.title' : 'whs.list.title')} text={t('whs.loadErrorText')} />
      ) : (
        <section className={styles.listCard} aria-labelledby="whs-list" data-testid="wholesalers-list">
          {noneYet ? null : (
            <div className={styles.listHead}>
              <h2 id="whs-list">{t(applications ? 'whs.apps.title' : 'whs.list.title')}</h2>
              {query.isPending ? (
                <span className={styles.loading} role="status"><span className={styles.spinner} aria-hidden />{t('whs.loading')}</span>
              ) : phone ? (
                <span className={styles.cardSub}>{t('whs.list.count', { count: rows.length })}</span>
              ) : (
                <span className={styles.cardSub}>{applications ? t('whs.apps.sub') : t('whs.list.asOf', { time })}</span>
              )}
            </div>
          )}
          {query.isPending || noneYet ? null : statusTabs}
          {noneYet || (applications && !all.some((item) => item.status === 'PENDING')) ? null : (
            <div className={styles.filters} role={phone ? 'search' : undefined} aria-label={phone ? t('whs.searchAria') : undefined}>
              {searchBox}
              {phone ? (
                <button type="button" className={styles.filtersButton} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
                  <ListFilter aria-hidden />
                  {t('whs.filters')}
                </button>
              ) : (
                <>
                  <PillSelect label={t('whs.filter.contract')} value={contract ?? ''} onChange={(value) => update({ contract: value || null })} options={contractOptions} onClear={() => update({ contract: null })} clearLabel={t('whs.filter.contractClear')} />
                  <PillSelect label={t('whs.filter.cabinet')} value={cabinet ?? ''} onChange={(value) => update({ cabinet: value || null })} options={cabinetOptions} onClear={() => update({ cabinet: null })} clearLabel={t('whs.filter.cabinetClear')} />
                  {hasFilters ? <button type="button" className={styles.resetButton} onClick={resetFilters}><RotateCcw aria-hidden />{t('whs.filtersReset')}</button> : null}
                </>
              )}
            </div>
          )}
          {listBody()}
        </section>
      )}

      {showOverview ? (
        <>
          <div className={styles.overview}>
            <AttentionCard items={attention.data ?? []} />
            <LaunchSteps />
          </div>
          <p className={styles.note}>{t('whs.note', { term: t('whs.returnTerm') })}</p>
        </>
      ) : null}

      {phone && showOverview ? (
        <PageActionBar>
          <Link to="/admin/wholesalers/new" className={styles.barPrimary}><Plus aria-hidden />{t('whs.add')}</Link>
        </PageActionBar>
      ) : null}

      {phone ? (
        <Dialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title={t('whs.filters')}
          icon={<ListFilter />}
          footer={(
            <>
              <DialogCancel onClick={() => update({ contract: null, cabinet: null })}>{t('whs.filtersClear')}</DialogCancel>
              <button type="button" className={styles.barPrimary} onClick={() => setFiltersOpen(false)}>{t('whs.filtersShow', { count: rows.length })}</button>
            </>
          )}
        >
          <SheetSelect label={t('whs.filter.contract')} value={contract ?? ''} options={contractOptions} onChange={(value) => update({ contract: value || null })} />
          <SheetSelect label={t('whs.filter.cabinet')} value={cabinet ?? ''} options={cabinetOptions} onChange={(value) => update({ cabinet: value || null })} />
          <p className={styles.sheetHint}>{t('whs.filtersHint')}</p>
        </Dialog>
      ) : null}

      {phone ? (
        <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title={t('whs.kpi.wholesalers')} description={t('whs.pageSheetSub')} icon={<EllipsisVertical />}>
          <ul className={styles.sheetMenu} role="menu">
            <li role="none">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDeclare(); }}><PackagePlus aria-hidden />{t('whs.pageSheetDeclare')}</button>
            </li>
          </ul>
        </Dialog>
      ) : null}
    </>
  );
}

function Header() {
  const { t } = useTranslation();
  const columns: [TranslationKey, 'wide' | 'end' | null][] = [
    ['whs.col.wholesaler', null], ['whs.col.status', null], ['whs.col.contract', 'wide'], ['whs.col.products', 'wide'],
    ['whs.col.stock', 'end'], ['whs.col.shipments', 'wide'], ['whs.col.payable', 'end'],
  ];
  return (
    <tr>
      {columns.map(([key, kind]) => <th key={key} scope="col" data-wide={kind === 'wide' || undefined} data-end={kind === 'end' || undefined}>{t(key)}</th>)}
      <th scope="col" className={styles.actionsCol}><span className={styles.visuallyHidden}>{t('whs.col.actions')}</span></th>
    </tr>
  );
}

function Kpi({ label, value, unit, sub, wide = false }: { label: string; value: string; unit: string; sub: string; wide?: boolean }) {
  return (
    <div className={styles.kpi} data-wide={wide || undefined}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}{unit ? <span> {unit}</span> : null}</span>
      {sub ? <span className={styles.kpiSub}>{sub}</span> : null}
    </div>
  );
}

function SheetSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly PillOption[]; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className={styles.sheetField}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.sheetSelect}>
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden />
      </span>
    </div>
  );
}
