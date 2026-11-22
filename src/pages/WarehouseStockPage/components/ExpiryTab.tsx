import { Ban, Bell, CalendarClock, CalendarX2, ChevronRight, CircleAlert, CircleCheck, CircleMinus, Clock, Hourglass, Move, MoreHorizontal, PackageX, Search, TriangleAlert, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLotsQuery } from '../../../features/inbound/api/inboundQueries';
import { daysLeft, saleCutoff, saleUntil } from '../../../features/inbound/lib/expiry';
import { LOT_FILTERS, type LotFilter, type LotState, type StockLot } from '../../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDate, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge, type BadgeTone } from '../../../shared/ui/Badge/Badge';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { PillSelect } from '../../../shared/ui/PillSelect/PillSelect';
import { ReturnLotDialog, WriteOffDialog } from './LotDialogs';
import styles from '../WarehouseStockPage.module.css';

const STATE_BADGE: Record<LotState, { tone: BadgeTone; icon: typeof Ban }> = {
  ON_SALE: { tone: 'success', icon: CircleCheck },
  APPROACHING: { tone: 'warning', icon: Hourglass },
  BLOCKED: { tone: 'danger', icon: Ban },
  EXPIRED: { tone: 'danger', icon: CalendarX2 },
  RETURNING: { tone: 'info', icon: Undo2 },
  WRITTEN_OFF: { tone: 'neutral', icon: CircleMinus },
};

/** «Muddat» (ombor-muddat; OMB-3): 60 kun qoidasi, partiyalar holati, kelgusi sanalar, xabarlar, muddatsiz SKU lar. */
export function ExpiryTab({ phone, onToList }: { phone: boolean; onToList: () => void }) {
  const { t } = useTranslation();
  const today = tashkentDate();
  const [state, setState] = useState<LotFilter | ''>('');
  const [search, setSearch] = useState('');
  const [wholesalerId, setWholesalerId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'writeOff' | 'return' | null>(null);
  const all = useLotsQuery({});
  const query = useLotsQuery({ state: state || undefined, search: search.trim() || undefined, wholesalerId: wholesalerId || undefined });
  const lots = useMemo(() => query.data?.items ?? [], [query.data]);
  const everything = useMemo(() => all.data?.items ?? [], [all.data]);
  const counts = all.data?.counts;
  const untracked = all.data?.untracked ?? [];
  const selected = lots.find((lot) => lot.id === selectedId) ?? null;
  const wholesalers = [...new Map(everything.map((lot) => [lot.wholesaler.id, lot.wholesaler.name])).entries()];

  if (all.isError && !all.data) return <LoadError error={all.error} onRetry={() => void all.refetch()} />;

  const byState = (value: LotState) => everything.filter((lot) => lot.state === value);
  const total = (list: readonly StockLot[]) => list.reduce((sum, lot) => sum + lot.quantity, 0);
  const tracked = everything.filter((lot) => lot.state !== 'WRITTEN_OFF');
  const skuCount = new Set(tracked.map((lot) => lot.sku.variantId)).size;
  const kpis: { key: string; label: string; value: number; sub: string; tone?: string }[] = [
    { key: 'tracked', label: t('inb.muddat.tracked'), value: tracked.length, sub: tracked.length ? t('inb.muddat.trackedSub', { count: total(tracked), skus: skuCount }) : t('inb.muddat.trackedNone') },
    { key: 'approaching', label: t('inb.lotState.APPROACHING'), value: counts?.APPROACHING ?? 0, sub: t('inb.muddat.approachingSub'), tone: counts?.APPROACHING ? 'warning' : undefined },
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
  const notices = everything.filter((lot) => lot.notifiedAt);
  const events = tracked
    .flatMap((lot) => [
      { key: `${lot.id}-sale`, date: saleUntil(lot.expiresAt), icon: Ban, title: t('inb.muddat.eventSaleEnd', { lot: lot.number }), sub: t('inb.muddat.eventSaleEndSub') },
      { key: `${lot.id}-exp`, date: lot.expiresAt, icon: CalendarClock, title: t('inb.muddat.eventExpires', { lot: lot.number }), sub: lot.state === 'ON_SALE' ? t('inb.muddat.eventRemainder') : t('inb.muddat.eventExpiresSub', { count: lot.quantity }) },
    ])
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const expiryCell = (lot: StockLot) => {
    const left = daysLeft(lot.expiresAt, today);
    const until = saleUntil(lot.expiresAt);
    const danger = lot.state !== 'ON_SALE' && lot.state !== 'APPROACHING';
    return (
      <span className={styles.stack}>
        <span className={styles.medium}>{isoToDots(lot.expiresAt)} · <span className={danger ? styles.danger : undefined}>{left < 0 ? t('inb.muddat.overdue', { days: -left }) : t('inb.muddat.left', { days: left })}</span></span>
        <span className={styles.sub}>
          {lot.state === 'RETURNING' ? t('inb.muddat.waiting') : left < 0 ? t('inb.muddat.ended') : until < today ? t('inb.muddat.saleEnded', { date: isoToDots(until) }) : t('inb.muddat.saleUntil', { date: isoToDots(until) })}
        </span>
      </span>
    );
  };
  const badge = (lot: StockLot) => <Badge tone={STATE_BADGE[lot.state].tone} icon={STATE_BADGE[lot.state].icon}>{t(`inb.lotState.${lot.state}`)}</Badge>;

  return (
    <>
      <div className={styles.rules}>
        <div><strong>{t('inb.muddat.days', { days: all.data?.rules.minShelfDays ?? 60 })}</strong><span>{t('inb.muddat.daysText', { days: all.data?.rules.minShelfDays ?? 60 })}</span></div>
        <div><strong>{isoToDots(saleCutoff(today))}</strong><span>{t('inb.muddat.cutoffText')}</span></div>
        <div><strong className={styles.muted}>{all.data?.rules.notifyDays ? t('inb.muddat.days', { days: all.data.rules.notifyDays }) : t('inb.muddat.notify')}</strong><span>{t('inb.muddat.notifyText')} <span className={styles.muted}>{t('inb.muddat.tbd')}</span></span></div>
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
              <p>{t('inb.muddat.cellText', { count: shared.quantity, cell: shared.sku.cell ?? '—', other: shared.sharesCellWith ?? '' })} <span className={styles.muted}>{t('inb.muddat.cellPlace')}</span>.</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className={styles.card} data-testid="lots-list">
        <div className={styles.cardHead}>
          <h2>{t('inb.muddat.listTitle')}</h2>
          {tracked.length ? <span>{t('inb.muddat.listSub', { count: tracked.length, quantity: total(tracked) })}{wholesalers.length === 1 ? ` · ${wholesalers[0][1]}` : ''}</span> : null}
        </div>
        {!everything.length && !all.isPending ? (
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
                  {key ? t(`inb.lotState.${key}`) : t('inb.muddat.all')}<span className={styles.count}>{counts?.[key || 'ALL'] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className={styles.filters}>
              <div className={styles.search}>
                <Search aria-hidden />
                <input type="search" aria-label={t('inb.muddat.search')} placeholder={t('inb.muddat.search')} value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <PillSelect label={t('inb.stock.wholesaler')} value={wholesalerId} onChange={setWholesalerId} options={[{ value: '', label: t('inb.stock.any') }, ...wholesalers.map(([value, label]) => ({ value, label }))]} />
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
                            <span className={styles.sub}>{lot.sku.name}</span>
                            <span className={styles.sub}>{lot.sku.cell ?? '—'}{lot.sharesCellWith ? <> · <span className={styles.warn}>{t('inb.muddat.sameCell', { other: lot.sharesCellWith })}</span></> : null}</span>
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
                      <button type="button" className={styles.dangerSoft} onClick={() => setDialog('writeOff')}><PackageX aria-hidden />{t('inb.muddat.writeOff')}</button>
                      <button type="button" className={styles.secondary} onClick={() => setDialog('return')}><Undo2 aria-hidden />{t('inb.muddat.return')}</button>
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
                      <span className={styles.strong}>{t('inb.muddat.noticeBlocked', { lot: lot.number, days: Math.max(0, daysLeft(lot.expiresAt, today)) })}</span>
                      <span className={styles.sub}>{t('inb.muddat.noticeTo', { wholesaler: lot.wholesaler.name, date: lot.notifiedAt ? tashkentDay(lot.notifiedAt) : '—' })}</span>
                    </span>
                    <Badge tone="success" icon={Bell}>{t('inb.muddat.noticeSent')}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.empty}>{t('inb.muddat.noNotices')}</p>}
            <p className={styles.footnote}>{t('inb.muddat.channel')} <span className={styles.muted}>{t('inb.muddat.channelTbd')}</span>{t('inb.muddat.channelEnd')}</p>
          </section>
        </div>
      ) : null}

      {untracked.length ? (
        <section className={styles.card}>
          <div className={styles.cardHeadRow}>
            <h2>{t('inb.muddat.untrackedTitle', { count: untracked.length })}</h2>
            <Badge tone="neutral" icon={Clock}>{t('inb.muddat.untrackedChip')}</Badge>
          </div>
          <p className={styles.text}>{t('inb.muddat.untrackedText', { names: untracked.map((item) => item.name).join(', ') })}</p>
          <button type="button" className={styles.more} onClick={onToList}>{t('inb.muddat.toList')}<ChevronRight aria-hidden /></button>
        </section>
      ) : null}

      <WriteOffDialog lot={dialog === 'writeOff' ? selected : null} phone={phone} onClose={() => setDialog(null)} onDone={() => { setDialog(null); setSelectedId(null); }} />
      <ReturnLotDialog lot={dialog === 'return' ? selected : null} phone={phone} onClose={() => setDialog(null)} onDone={() => { setDialog(null); setSelectedId(null); }} />
    </>
  );
}
