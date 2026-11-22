import type { UseQueryResult } from '@tanstack/react-query';
import { Ban, Bell, CalendarClock, CalendarX2, CircleAlert, CircleCheck, Move, MoreHorizontal, PackageX, Search, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { daysLeft, MIN_SHELF_DAYS, saleCutoff } from '../../../features/inbound/lib/expiry';
import { LOT_FILTERS, type LotFilter, type LotState, type StockLot, type WarehouseStockRow } from '../../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDate } from '../../../shared/lib/tashkentTime';
import { Badge, type BadgeTone } from '../../../shared/ui/Badge/Badge';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { PillSelect } from '../../../shared/ui/PillSelect/PillSelect';
import { lotViews, type LotView } from '../lotView';
import { WriteOffDialog } from './LotDialogs';
import styles from '../WarehouseStockPage.module.css';

const STATE_BADGE: Record<LotState, { tone: BadgeTone; icon: typeof Ban }> = {
  ON_SALE: { tone: 'success', icon: CircleCheck },
  BLOCKED: { tone: 'danger', icon: Ban },
  EXPIRED: { tone: 'danger', icon: CalendarX2 },
};

interface ExpiryTabProps {
  query: UseQueryResult<StockLot[]>;
  stock: readonly WarehouseStockRow[];
  phone: boolean;
}

/** «Muddat» (ombor-muddat; OMB-3): 60 kun qoidasi, partiyalar holati, kelgusi sanalar, xabarlar. */
export function ExpiryTab({ query, stock, phone }: ExpiryTabProps) {
  const { t } = useTranslation();
  const today = tashkentDate();
  const [state, setState] = useState<LotFilter | ''>('');
  const [search, setSearch] = useState('');
  const [wholesaler, setWholesaler] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [writeOff, setWriteOff] = useState(false);
  const everything = useMemo(() => lotViews(query.data ?? [], stock, today), [query.data, stock, today]);
  const words = search.trim().toLowerCase();
  const lots = everything.filter((lot) =>
    (!state || lot.state === state) &&
    (!wholesaler || lot.wholesalerName === wholesaler) &&
    (!words || [lot.number, lot.productName, lot.sku].some((value) => value.toLowerCase().includes(words))));
  const selected = lots.find((lot) => lot.id === selectedId) ?? null;
  const wholesalers = [...new Set(everything.map((lot) => lot.wholesalerName).filter((name): name is string => Boolean(name)))];

  if (query.isError && !query.data) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;

  const byState = (value: LotState) => everything.filter((lot) => lot.state === value);
  const counts: Record<'ALL' | LotFilter, number> = { ALL: everything.length, BLOCKED: byState('BLOCKED').length, EXPIRED: byState('EXPIRED').length };
  const total = (list: readonly LotView[]) => list.reduce((sum, lot) => sum + lot.quantity, 0);
  const skuCount = new Set(everything.map((lot) => lot.variantId)).size;
  const kpis: { key: string; label: string; value: number; sub: string; tone?: string }[] = [
    { key: 'tracked', label: t('inb.muddat.tracked'), value: everything.length, sub: everything.length ? t('inb.muddat.trackedSub', { count: total(everything), skus: skuCount }) : t('inb.muddat.trackedNone') },
    ...(['BLOCKED', 'EXPIRED'] as const).map((key) => {
      const list = byState(key);
      return {
        key, label: t(`inb.lotState.${key}`), value: list.length, tone: list.length ? 'danger' : undefined,
        sub: list.length ? t('inb.muddat.lotsSub', { count: total(list), lots: list.map((lot) => lot.number).join(', ') }) : key === 'EXPIRED' ? t('inb.muddat.expiredSub') : '—',
      };
    }),
  ];
  const shared = byState('BLOCKED').find((lot) => lot.sharesCellWith);
  const expired = byState('EXPIRED')[0];
  const notices = everything.filter((lot) => lot.state !== 'ON_SALE');
  const events = everything
    .flatMap((lot) => [
      { key: `${lot.id}-sale`, date: lot.sellableUntil, icon: Ban, title: t('inb.muddat.eventSaleEnd', { lot: lot.number }), sub: t('inb.muddat.eventSaleEndSub') },
      { key: `${lot.id}-exp`, date: lot.expiryDate, icon: CalendarClock, title: t('inb.muddat.eventExpires', { lot: lot.number }), sub: lot.state === 'ON_SALE' ? t('inb.muddat.eventRemainder') : t('inb.muddat.eventExpiresSub', { count: lot.quantity }) },
    ])
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const expiryCell = (lot: LotView) => {
    const left = daysLeft(lot.expiryDate, today);
    return (
      <span className={styles.stack}>
        <span className={styles.medium}>{isoToDots(lot.expiryDate)} · <span className={lot.state !== 'ON_SALE' ? styles.danger : undefined}>{left < 0 ? t('inb.muddat.overdue', { days: -left }) : t('inb.muddat.left', { days: left })}</span></span>
        <span className={styles.sub}>
          {left < 0 ? t('inb.muddat.ended') : lot.sellableUntil < today ? t('inb.muddat.saleEnded', { date: isoToDots(lot.sellableUntil) }) : t('inb.muddat.saleUntil', { date: isoToDots(lot.sellableUntil) })}
        </span>
      </span>
    );
  };
  const badge = (lot: LotView) => <Badge tone={STATE_BADGE[lot.state].tone} icon={STATE_BADGE[lot.state].icon}>{t(`inb.lotState.${lot.state}`)}</Badge>;

  return (
    <>
      <div className={styles.rules}>
        <div><strong>{t('inb.muddat.days', { days: MIN_SHELF_DAYS })}</strong><span>{t('inb.muddat.daysText', { days: MIN_SHELF_DAYS })}</span></div>
        <div><strong>{isoToDots(saleCutoff(today))}</strong><span>{t('inb.muddat.cutoffText')}</span></div>
        <div><strong className={styles.muted}>{t('inb.muddat.notify')}</strong><span>{t('inb.muddat.notifyText')} <span className={styles.muted}>{t('inb.muddat.tbd')}</span></span></div>
      </div>
      <p className={styles.scope}>{t('inb.muddat.scope')}</p>
      <div className={styles.kpis}>
        {kpis.map((kpi) => (
          <div key={kpi.key} className={styles.kpi} data-kpi={kpi.key}>
            <span className={styles.kpiLabel}>{kpi.label}</span>
            <span className={styles.kpiValue} data-tone={kpi.tone}>{kpi.value}<span> {t('inb.muddat.lotUnit')}</span></span>
            <span className={styles.kpiSub}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      {expired ? (
        <div className={styles.banner} data-tone="danger" role="note">
          <div className={styles.bannerBody}>
            <CircleAlert aria-hidden />
            <div>
              <p className={styles.bannerTitle}>{t('inb.muddat.expiredTitle', { lot: expired.number, count: expired.quantity })}</p>
              <p>{t('inb.muddat.expiredText')} <span className={styles.muted}>{t('inb.muddat.decision')}</span>.</p>
            </div>
          </div>
        </div>
      ) : shared ? (
        <div className={styles.banner} role="note" data-testid="lot-cell-warning">
          <div className={styles.bannerBody}>
            <TriangleAlert aria-hidden />
            <div>
              <p className={styles.bannerTitle}>{t('inb.muddat.cellTitle', { lot: shared.number })}</p>
              <p>{t('inb.muddat.cellText', { count: shared.quantity, cell: shared.cell ?? '—', other: shared.sharesCellWith ?? '' })} <span className={styles.muted}>{t('inb.muddat.cellPlace')}</span>.</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className={styles.card} data-testid="lots-list">
        <div className={styles.cardHead}>
          <h2>{t('inb.muddat.listTitle')}</h2>
          {everything.length ? <span>{t('inb.muddat.listSub', { count: everything.length, quantity: total(everything) })}{wholesalers.length === 1 ? ` · ${wholesalers[0]}` : ''}</span> : null}
        </div>
        {!everything.length && !query.isPending ? (
          <div className={styles.emptyBlock}>
            <span aria-hidden><CalendarClock /></span>
            <strong>{t('inb.muddat.emptyTitle')}</strong>
            <p>{t('inb.muddat.emptyText')}</p>
          </div>
        ) : (
          <>
            <div className={styles.tabs} role="tablist" aria-label={t('inb.muddat.listAria')}>
              {(['', ...LOT_FILTERS] as const).map((key) => (
                <button key={key || 'ALL'} type="button" role="tab" className={styles.tab} aria-selected={state === key} onClick={() => { setState(key); setSelectedId(null); }}>
                  {key ? t(`inb.lotState.${key}`) : t('inb.muddat.all')}<span className={styles.count}>{counts[key || 'ALL']}</span>
                </button>
              ))}
            </div>
            <div className={styles.filters}>
              <div className={styles.search}>
                <Search aria-hidden />
                <input type="search" aria-label={t('inb.muddat.search')} placeholder={t('inb.muddat.search')} value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <PillSelect label={t('inb.stock.wholesaler')} value={wholesaler} onChange={setWholesaler} options={[{ value: '', label: t('inb.stock.any') }, ...wholesalers.map((name) => ({ value: name, label: name }))]} />
            </div>
            {lots.length ? (
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('inb.muddat.col.lot')}</th>
                      <th>{t('inb.muddat.col.state')}</th>
                      <th>{t('inb.muddat.col.expiry')}</th>
                      <th className={styles.num}>{t('inb.muddat.col.qty')}</th>
                      <th className={styles.actions}><span className={styles.visuallyHidden}>{t('inb.muddat.actions', { lot: '' })}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((lot) => (
                      <tr key={lot.id} data-lot={lot.number} data-selected={lot.id === selectedId || undefined} onClick={() => setSelectedId(lot.id === selectedId ? null : lot.id)}>
                        <td>
                          <span className={styles.stack}>
                            <span className={styles.strong}>{lot.number}</span>
                            <span className={styles.sub}>{lot.productName}</span>
                            <span className={styles.sub}>{lot.cell ?? '—'}{lot.sharesCellWith ? <> · <span className={styles.warn}>{t('inb.muddat.sameCell', { other: lot.sharesCellWith })}</span></> : null}</span>
                          </span>
                        </td>
                        <td>{badge(lot)}</td>
                        <td>{expiryCell(lot)}</td>
                        <td className={styles.num}>{lot.quantity}</td>
                        <td className={styles.actions}>
                          <button type="button" className={styles.iconButton} aria-label={t('inb.muddat.actions', { lot: lot.number })} onClick={(event) => { event.stopPropagation(); setSelectedId(lot.id); }}>
                            <MoreHorizontal aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className={styles.empty}>{t('inb.muddat.empty')}</p>}
            {selected ? (
              <div className={styles.selectedBar} data-testid="lot-selected">
                <span>{t('inb.muddat.selected', { lot: selected.number, count: selected.quantity, state: t(`inb.lotState.${selected.state}`).toLowerCase() })}</span>
                <span className={styles.selectedActions}>
                  {selected.state === 'EXPIRED' ? (
                    <>
                      <button type="button" className={styles.dangerSoft} onClick={() => setWriteOff(true)}><PackageX aria-hidden />{t('inb.muddat.writeOff')}</button>
                    </>
                  ) : null}
                  {selected.state === 'BLOCKED' ? <Link className={styles.secondary} to="/warehouse/sku"><Move aria-hidden />{t('inb.muddat.move')}</Link> : null}
                </span>
              </div>
            ) : null}
          </>
        )}
      </section>

      {everything.length ? (
        <div className={styles.pair}>
          <section className={styles.card}>
            <div className={styles.cardHead}><h2>{t('inb.muddat.upcomingTitle')}</h2><span>{t('inb.muddat.upcomingSub')}</span></div>
            {events.length ? (
              <ul className={styles.events}>
                {events.map((event) => {
                  const Icon = event.icon;
                  return (
                    <li key={event.key}>
                      <span className={styles.eventIcon} aria-hidden><Icon /></span>
                      <span className={styles.stack}>
                        <span className={styles.sub}>{isoToDots(event.date)}</span>
                        <span className={styles.strong}>{event.title}</span>
                        <span className={styles.sub}>{event.sub}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className={styles.empty}>{t('inb.muddat.noUpcoming')}</p>}
          </section>
          <section className={styles.card}>
            <div className={styles.cardHead}><h2>{t('inb.muddat.noticesTitle')}</h2><span>{t('inb.muddat.noticesSub')}</span></div>
            {notices.length ? (
              <ul className={styles.list}>
                {notices.map((lot) => (
                  <li key={lot.id}>
                    <span className={styles.stack}>
                      <span className={styles.strong}>{t('inb.muddat.noticeBlocked', { lot: lot.number, days: Math.max(0, daysLeft(lot.expiryDate, today)) })}</span>
                      <span className={styles.sub}>{t('inb.muddat.noticeTo')}</span>
                    </span>
                    <Badge tone="neutral" icon={Bell}>{t('inb.muddat.noticeAuto')}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.empty}>{t('inb.muddat.noNotices')}</p>}
            <p className={styles.footnote}>{t('inb.muddat.channel')} <span className={styles.muted}>{t('inb.muddat.channelTbd')}</span>{t('inb.muddat.channelEnd')}</p>
          </section>
        </div>
      ) : null}

      <WriteOffDialog key={writeOff ? selected?.id ?? 'none' : 'closed'} lot={writeOff ? selected : null} phone={phone} onClose={() => setWriteOff(false)} onDone={() => { setWriteOff(false); setSelectedId(null); }} />
    </>
  );
}
