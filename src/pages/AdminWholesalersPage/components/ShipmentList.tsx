import { Dropdown } from 'antd';
import { CalendarDays, ExternalLink, FileText, MoreHorizontal, PackagePlus, Search, SlidersHorizontal, XCircle } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShipmentsQuery } from '../../../features/inbound/api/inboundQueries';
import { adminShipmentPath, arrivalNote, authorLabel, inboundActPath } from '../../../features/inbound/lib/shipmentLabels';
import { SHIPMENT_STATUSES, type InboundShipment, type InboundWholesaler, type ShipmentListParams, type ShipmentStatus } from '../../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { addDays, tashkentDate } from '../../../shared/lib/tashkentTime';
import { DateInput } from '../../../shared/ui/DateInput/DateInput';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { PillSelect } from '../../../shared/ui/PillSelect/PillSelect';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { CancelShipmentDialog } from './CancelShipmentDialog';
import styles from './ShipmentList.module.css';

type ExpectedPreset = '' | 'today' | 'tomorrow' | 'week' | 'past';

interface ShipmentFilters {
  status: ShipmentStatus | '';
  search: string;
  wholesalerId: string;
  author: '' | 'WHOLESALER' | 'STAFF';
  expected: ExpectedPreset;
  expectedFrom: string | null;
  expectedTo: string | null;
}

const EMPTY_FILTERS: ShipmentFilters = { status: '', search: '', wholesalerId: '', author: '', expected: '', expectedFrom: null, expectedTo: null };

function expectedRange(filters: ShipmentFilters, today: string): Pick<ShipmentListParams, 'expectedFrom' | 'expectedTo'> {
  switch (filters.expected) {
    case 'today': return { expectedFrom: today, expectedTo: today };
    case 'tomorrow': return { expectedFrom: addDays(today, 1), expectedTo: addDays(today, 1) };
    case 'week': return { expectedFrom: today, expectedTo: addDays(today, 7) };
    case 'past': return { expectedFrom: addDays(today, -30), expectedTo: addDays(today, -1) };
    default: return { expectedFrom: filters.expectedFrom ?? undefined, expectedTo: filters.expectedTo ?? undefined };
  }
}

interface ShipmentListProps {
  wholesalers: readonly InboundWholesaler[];
  /** Yangi saqlangan arizalar — ro'yxat tepasida belgilangan. */
  highlight: readonly string[];
  /** Bo'sh holatdagi «Arizani kiritish» — formaga. */
  onCreate: () => void;
}

/** «Postavkalar · hamma optovik» (admin-postavka): holat tablari, filtrlar, jadval; telefonda kartalar va filtr varag'i. */
export function ShipmentList({ wholesalers, highlight, onCreate }: ShipmentListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const today = tashkentDate();
  const [filters, setFilters] = useState<ShipmentFilters>(EMPTY_FILTERS);
  const [sheet, setSheet] = useState<ShipmentFilters | null>(null);
  const [cancelling, setCancelling] = useState<InboundShipment | null>(null);
  const searchId = useId();
  const params: ShipmentListParams = {
    page: 1,
    limit: 100,
    status: filters.status ? [filters.status] : undefined,
    search: filters.search.trim() || undefined,
    wholesalerId: filters.wholesalerId || undefined,
    authorRole: filters.author || undefined,
    ...expectedRange(filters, today),
  };
  const query = useShipmentsQuery(params);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const counts = query.data?.counts;
  const total = query.data?.total ?? 0;
  const filtered = Boolean(params.search || params.wholesalerId || params.authorRole || params.expectedFrom || params.expectedTo);
  const set = (patch: Partial<ShipmentFilters>) => setFilters((previous) => ({ ...previous, ...patch }));

  const any = t('inb.list.any');
  const wholesalerOptions = [{ value: '', label: any }, ...wholesalers.map((item) => ({ value: item.id, label: item.name }))];
  const authorOptions = [{ value: '', label: any }, { value: 'WHOLESALER', label: t('inb.list.authorCabinet') }, { value: 'STAFF', label: t('inb.list.authorStaff') }];
  const expectedOptions = [
    { value: '', label: any },
    { value: 'today', label: t('inb.list.expectedToday') },
    { value: 'tomorrow', label: t('inb.list.expectedTomorrow') },
    { value: 'week', label: t('inb.list.expectedWeek') },
    { value: 'past', label: t('inb.list.expectedPast') },
  ];

  const tabs = (
    <div className={styles.tabs} role="tablist" aria-label={t('inb.list.statusAria')}>
      {(['', ...SHIPMENT_STATUSES] as const).map((status) => (
        <button key={status || 'ALL'} type="button" role="tab" className={styles.tab} aria-selected={filters.status === status} onClick={() => set({ status })}>
          {status ? t(`status.shipment.${status}`) : t('inb.list.all')}
          <span className={styles.count}>{counts?.[status || 'ALL'] ?? 0}</span>
        </button>
      ))}
    </div>
  );

  const open = (shipment: InboundShipment) => void navigate(adminShipmentPath(shipment.id));
  const canCancel = (shipment: InboundShipment) => shipment.status === 'DECLARED' && !shipment.receivingStartedAt;

  const menu = (shipment: InboundShipment) => (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'open', icon: <ExternalLink aria-hidden />, label: t('inb.list.open') },
          { key: 'act', icon: <FileText aria-hidden />, label: t('inb.list.openAct'), disabled: !shipment.completedAt },
          { type: 'divider' },
          { key: 'cancel', icon: <XCircle aria-hidden />, label: t('inb.list.cancel'), danger: true, disabled: !canCancel(shipment) },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === 'open') open(shipment);
          else if (key === 'act') window.open(inboundActPath(shipment.id), '_blank', 'noopener');
          else if (key === 'cancel') setCancelling(shipment);
        },
      }}
    >
      <button type="button" className={styles.iconButton} aria-label={t('inb.list.actions', { number: shipment.number })} title={t('inb.list.actions', { number: shipment.number })} onClick={(event) => event.stopPropagation()}>
        <MoreHorizontal aria-hidden />
      </button>
    </Dropdown>
  );

  const actCell = (shipment: InboundShipment) => {
    if (shipment.completedAt) {
      return (
        <a className={styles.pdf} href={inboundActPath(shipment.id)} target="_blank" rel="noopener" onClick={(event) => event.stopPropagation()}>
          <FileText aria-hidden />{t('inb.list.pdf')}
        </a>
      );
    }
    return <span className={styles.sub}>{shipment.status === 'CANCELLED' ? '—' : t('inb.list.actLater')}</span>;
  };

  const number = (value: number | null, shipment: InboundShipment) => (shipment.completedAt ? value : '—');

  const table = (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>{t('inb.list.caption')}</caption>
        <thead>
          <tr>
            <th>{t('inb.list.col.number')}</th>
            <th>{t('inb.list.col.product')}</th>
            <th className={styles.wide}>{t('inb.list.col.expected')}</th>
            <th className={styles.num}>{t('inb.list.col.declared')}</th>
            <th className={styles.num}>{t('inb.list.col.accepted')}</th>
            <th className={styles.num}>{t('inb.list.col.defect')}</th>
            <th>{t('inb.list.col.status')}</th>
            <th className={styles.wide}>{t('inb.list.col.author')}</th>
            <th className={`${styles.num} ${styles.wide}`}>{t('inb.list.col.act')}</th>
            <th className={styles.actions}><span className={styles.visuallyHidden}>{t('inb.list.actions', { number: '' })}</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((shipment) => {
            const note = arrivalNote(t, shipment, today);
            const author = authorLabel(t, shipment.createdBy);
            return (
              <tr key={shipment.id} data-shipment-id={shipment.id} data-new={highlight.includes(shipment.id) || undefined} onClick={() => open(shipment)}>
                <td>
                  <span className={styles.number}>{shipment.number}</span>
                  <span className={`${styles.sub} ${styles.narrow}`}>{isoToDots(shipment.expectedAt)}</span>
                </td>
                <td>
                  <span className={styles.stack}>
                    <span className={styles.strong}>{shipment.sku.name}</span>
                    <span className={styles.sub}>{shipment.wholesaler.name}</span>
                  </span>
                </td>
                <td className={styles.wide}>
                  <span className={styles.stack}>
                    <span className={styles.medium}>{isoToDots(shipment.expectedAt)}</span>
                    {note ? <span className={styles.sub}>{note}</span> : null}
                  </span>
                </td>
                <td className={styles.num}>{shipment.declared}</td>
                <td className={styles.num}>{number(shipment.accepted, shipment)}</td>
                <td className={styles.num} data-alert={Boolean(shipment.completedAt && shipment.defect) || undefined}>{number(shipment.defect, shipment)}</td>
                <td><StatusBadge family="shipment" code={shipment.status} /></td>
                <td className={styles.wide}>
                  <span className={styles.stack}>
                    <span className={styles.medium}>{author.name}</span>
                    <span className={styles.sub}>{author.sub}</span>
                  </span>
                </td>
                <td className={`${styles.num} ${styles.wide}`}>{actCell(shipment)}</td>
                <td className={styles.actions}>{menu(shipment)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const cards = (
    <ul className={styles.cards} aria-label={t('inb.list.caption')}>
      {items.map((shipment) => {
        const note = arrivalNote(t, shipment, today);
        const author = authorLabel(t, shipment.createdBy);
        const who = `${author.name} (${author.sub})`;
        const status = t(`status.shipment.${shipment.status}`);
        return (
          <li key={shipment.id} data-shipment-id={shipment.id} data-new={highlight.includes(shipment.id) || undefined}>
            <a href={adminShipmentPath(shipment.id)} className={styles.card} aria-label={t('inb.list.cardOpen', { number: shipment.number, product: shipment.sku.name, status })} onClick={(event) => { event.preventDefault(); open(shipment); }}>
              <span className={styles.cardTop}>
                <span className={styles.cardNumber}>{shipment.number}</span>
                <StatusBadge family="shipment" code={shipment.status} />
              </span>
              <span className={styles.cardProduct}>{shipment.sku.name} <span>· {shipment.wholesaler.name}</span></span>
              <span className={styles.cardBottom}>
                <span className={styles.sub}>
                  {note ? t('inb.list.cardMetaNote', { date: isoToDots(shipment.expectedAt), note, author: who }) : t('inb.list.cardMeta', { date: isoToDots(shipment.expectedAt), author: who })}
                </span>
                <span className={styles.cardQty}>
                  <span>{t('inb.list.cardDeclared')}</span>
                  {t('inb.pieces', { count: shipment.declared })}
                </span>
              </span>
              {shipment.completedAt ? (
                <span className={styles.cardResult}>
                  {t('inb.list.cardResult', { accepted: shipment.accepted, defect: shipment.defect })}
                </span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );

  const body = () => {
    if (query.isError && !query.data) return <LoadError error={query.error} onRetry={() => void query.refetch()} title={t('inb.list.title')} />;
    if (query.isPending) {
      return (
        <div className={styles.skeleton} aria-busy="true">
          {[0, 1, 2].map((index) => <span key={index} />)}
          <p className={styles.loading}><span className={styles.spinner} aria-hidden />{t('inb.list.loading')}</p>
        </div>
      );
    }
    if (!items.length) {
      const firstEver = !filtered && !filters.status && (counts?.ALL ?? 0) === 0;
      return (
        <div className={styles.empty} data-testid="shipments-empty">
          <span className={styles.emptyIcon} aria-hidden><PackagePlus /></span>
          <h3>{firstEver ? t('inb.list.emptyTitle') : t('inb.list.noResults')}</h3>
          <p>{firstEver ? t('inb.list.emptyText') : t('inb.list.noResultsText')}</p>
          {firstEver
            ? <button type="button" className={styles.primary} onClick={onCreate}><PackagePlus aria-hidden />{t('inb.list.emptyAction')}</button>
            : <button type="button" className={styles.secondary} onClick={() => setFilters(EMPTY_FILTERS)}>{t('inb.list.clear')}</button>}
        </div>
      );
    }
    return phone ? cards : table;
  };

  const footer = items.length ? (
    <div className={styles.footer}>
      <span>{phone ? t('inb.list.footerPhone', { shown: items.length, total }) : t('inb.list.footer', { from: 1, to: items.length, total })}</span>
      {phone ? null : (
        <span>
          <span className={styles.wide}>{highlight.length ? t('inb.list.newMark') : t('inb.list.footerHint')}</span>
          <span className={styles.narrow}>{t('inb.list.footerHintTablet')}</span>
        </span>
      )}
    </div>
  ) : null;

  return (
    <section className={styles.section} data-testid="shipment-list">
      <div className={styles.head}>
        <h2>{t('inb.list.title')}</h2>
        <span className={styles.headSub}>{phone ? t('inb.list.subPhone', { count: counts?.ALL ?? 0 }) : t('inb.list.sub')}</span>
      </div>
      {tabs}
      {phone ? (
        <div className={styles.phoneFilters} role="search" aria-label={t('inb.list.searchAria')}>
          <div className={styles.search}>
            <Search aria-hidden />
            <input type="search" aria-label={t('inb.list.searchAria')} placeholder={t('inb.list.searchPhone')} value={filters.search} onChange={(event) => set({ search: event.target.value })} />
          </div>
          <button type="button" className={styles.filtersButton} onClick={() => setSheet(filters)}><SlidersHorizontal aria-hidden />{t('inb.list.filters')}</button>
        </div>
      ) : (
        <div className={styles.filters}>
          <div className={styles.search}>
            <Search aria-hidden />
            <input id={searchId} type="search" aria-label={t('inb.list.searchAria')} placeholder={t('inb.list.search')} value={filters.search} onChange={(event) => set({ search: event.target.value })} />
          </div>
          <PillSelect label={t('inb.list.wholesaler')} value={filters.wholesalerId} options={wholesalerOptions} onChange={(wholesalerId) => set({ wholesalerId })} />
          <PillSelect label={t('inb.list.author')} value={filters.author} options={authorOptions} onChange={(author) => set({ author: author as ShipmentFilters['author'] })} />
          <PillSelect label={t('inb.list.expected')} icon={CalendarDays} value={filters.expected} options={expectedOptions} onChange={(expected) => set({ expected: expected as ExpectedPreset, expectedFrom: null, expectedTo: null })} />
        </div>
      )}
      <div className={styles.body}>
        {body()}
        {footer}
      </div>

      <Dialog
        open={sheet !== null}
        title={t('inb.list.filters')}
        icon={<SlidersHorizontal size={20} />}
        onClose={() => setSheet(null)}
        footer={(
          <>
            <DialogCancel onClick={() => { setFilters({ ...EMPTY_FILTERS, status: filters.status }); setSheet(null); }}>{t('inb.list.clear')}</DialogCancel>
            <DialogPrimary shortcut={false} onClick={() => { if (sheet) setFilters(sheet); setSheet(null); }}>{t('inb.list.show', { count: total })}</DialogPrimary>
          </>
        )}
      >
        {sheet ? (
          <div className={styles.sheet}>
            <label className={styles.sheetLabel} htmlFor={`${searchId}-w`}>{t('inb.list.wholesaler')}</label>
            <SearchSelect id={`${searchId}-w`} label={t('inb.list.wholesaler')} value={sheet.wholesalerId} options={wholesalerOptions} placeholder={any} searchable={false} onChange={(wholesalerId) => setSheet({ ...sheet, wholesalerId })} />
            <label className={styles.sheetLabel} htmlFor={`${searchId}-a`}>{t('inb.list.author')}</label>
            <SearchSelect id={`${searchId}-a`} label={t('inb.list.author')} value={sheet.author} options={authorOptions} placeholder={any} searchable={false} onChange={(author) => setSheet({ ...sheet, author: author as ShipmentFilters['author'] })} />
            <label className={styles.sheetLabel} htmlFor={`${searchId}-f`}>{t('inb.list.expectedFrom')}</label>
            <DateInput id={`${searchId}-f`} value={sheet.expectedFrom} onChange={(expectedFrom) => setSheet({ ...sheet, expected: '', expectedFrom })} />
            <label className={styles.sheetLabel} htmlFor={`${searchId}-t`}>{t('inb.list.expectedTo')}</label>
            <DateInput id={`${searchId}-t`} value={sheet.expectedTo} onChange={(expectedTo) => setSheet({ ...sheet, expected: '', expectedTo })} />
            <p className={styles.sheetNote}>{t('inb.list.statusInTabs')}</p>
          </div>
        ) : null}
      </Dialog>

      <CancelShipmentDialog shipment={cancelling} onClose={() => setCancelling(null)} />
    </section>
  );
}
