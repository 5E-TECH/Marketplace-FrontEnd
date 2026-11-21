import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Search, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShipmentsQuery } from '../../../features/inbound/api/inboundQueries';
import { AWAITING_STATUSES, type WarehouseStockRow } from '../../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { addDays, tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { PillSelect } from '../../../shared/ui/PillSelect/PillSelect';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../WarehouseStockPage.module.css';

type Chip = 'zero' | 'soon' | 'reserved';

/** «Ro'yxat» (ombor-qoldiq): omborda / band / mavjud / brak, «mavjud 0» ogohlantirishi, SKU jadvali, band va kirim. */
export function StockListTab({ query, phone }: { query: UseQueryResult<WarehouseStockRow[]>; phone: boolean }) {
  const { t } = useTranslation();
  const today = tashkentDate();
  const awaiting = useShipmentsQuery({ page: 1, limit: 100, status: AWAITING_STATUSES, sort: 'expectedAt' }).data?.items ?? [];
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const [search, setSearch] = useState('');
  const [wholesaler, setWholesaler] = useState('');
  const [expiry, setExpiry] = useState('');
  const [chip, setChip] = useState<Chip | null>(null);

  const soon = (row: WarehouseStockRow) => row.lots.some((lot) => !lot.sellable);
  const tracked = (row: WarehouseStockRow) => row.lots.some((lot) => lot.expiresAt);
  const chipTest: Record<Chip, (row: WarehouseStockRow) => boolean> = { zero: (row) => row.available === 0, soon, reserved: (row) => row.reserved > 0 };
  const words = search.trim().toLowerCase();
  const visible = rows.filter((row) =>
    (!words || [row.name, row.cell ?? '', row.barcode ?? ''].some((value) => value.toLowerCase().includes(words))) &&
    (!wholesaler || row.wholesalerName === wholesaler) &&
    (!expiry || (expiry === 'tracked') === tracked(row)) &&
    (!chip || chipTest[chip](row)));
  const sum = (key: 'onHand' | 'reserved' | 'available' | 'defect' | 'reservedToday' | 'reservedTomorrow', list = rows) => list.reduce((total, row) => total + row[key], 0);
  const cells = new Set(rows.map((row) => row.cell).filter(Boolean)).size;
  const zero = rows.find((row) => row.available === 0 && row.onHand > 0);
  const zeroIncoming = zero ? awaiting.find((item) => item.sku.variantId === zero.variantId) : undefined;
  const wholesalers = [...new Set(rows.map((row) => row.wholesalerName).filter((name): name is string => Boolean(name)))];
  const reservedRows = rows.filter((row) => row.reserved > 0);
  const incomingQuantity = awaiting.reduce((total, item) => total + item.declared, 0);
  const updatedAt = query.dataUpdatedAt ? tashkentClock(query.dataUpdatedAt) : '—';

  if (query.isError && !query.data) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;

  const kpis = [
    { label: t('inb.stock.onHand'), value: sum('onHand'), sub: t('inb.stock.onHandSub', { skus: rows.length, cells }) },
    { label: t('inb.stock.reserved'), value: sum('reserved'), sub: t('inb.stock.reservedSub', { today: sum('reservedToday'), tomorrow: sum('reservedTomorrow') }) },
    { label: t('inb.stock.available'), value: sum('available'), sub: t('inb.stock.availableSub') },
    { label: t('inb.stock.defect'), value: sum('defect'), sub: t('inb.stock.defectSub') },
  ];
  const lotCell = (row: WarehouseStockRow) => {
    const blocked = row.lots.filter((lot) => !lot.sellable).length;
    return (
      <span className={styles.stack}>
        <span className={styles.medium}>{row.lots.map((lot) => lot.number).join(' · ') || '—'}</span>
        <span className={styles.sub}>{tracked(row) ? [row.lots.map((lot) => isoToDots(lot.expiresAt)).join(' · '), blocked ? t('inb.stock.blockedPart', { count: blocked }) : null].filter(Boolean).join(' · ') : t('inb.stock.noExpiry')}</span>
      </span>
    );
  };
  const availableCell = (row: WarehouseStockRow) => (row.available === 0
    ? <span className={styles.zero}><strong>0</strong><span>{t('inb.stock.soldOut')}</span></span>
    : <strong>{row.available}</strong>);

  return (
    <>
      <div className={styles.kpis}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={styles.kpi}>
            <span className={styles.kpiLabel}>{kpi.label}</span>
            <span className={styles.kpiValue}>{kpi.value}<span> {t('inb.unit')}</span></span>
            <span className={styles.kpiSub}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      {zero ? (
        <div className={styles.banner} role="note" data-testid="stock-zero">
          <div className={styles.bannerBody}>
            <TriangleAlert aria-hidden />
            <div>
              <p className={styles.bannerTitle}>{t('inb.stock.zeroTitle', { product: zero.name })}</p>
              <p>{t('inb.stock.zeroText', { onHand: zero.onHand })}{zeroIncoming ? ` ${t('inb.stock.zeroIncoming', { number: zeroIncoming.number, count: zeroIncoming.declared })}` : ''}</p>
            </div>
          </div>
          {zeroIncoming ? <Link className={styles.bannerLink} to="/warehouse">{t('inb.stock.zeroLink', { number: zeroIncoming.number })}<ArrowRight aria-hidden /></Link> : null}
        </div>
      ) : null}

      <section className={styles.card} data-testid="stock-table">
        <div className={styles.cardHead}>
          <h2>{t('inb.stock.title')}</h2>
          <span>{t('inb.stock.sub', { time: updatedAt })}</span>
        </div>
        <div className={styles.filters}>
          <div className={styles.search}>
            <Search aria-hidden />
            <input type="search" aria-label={t('inb.stock.search')} placeholder={t('inb.stock.search')} value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <PillSelect label={t('inb.stock.wholesaler')} value={wholesaler} onChange={setWholesaler} options={[{ value: '', label: t('inb.stock.any') }, ...wholesalers.map((name) => ({ value: name, label: name }))]} />
          <PillSelect label={t('inb.stock.expiry')} value={expiry} onChange={setExpiry} options={[{ value: '', label: t('inb.stock.any') }, { value: 'tracked', label: t('inb.stock.expiryTracked') }, { value: 'none', label: t('inb.stock.expiryNone') }]} />
        </div>
        <div className={styles.chips} role="group" aria-label={t('inb.stock.chipsAria')}>
          {([['zero', 'inb.stock.chipZero'], ['soon', 'inb.stock.chipSoon'], ['reserved', 'inb.stock.chipReserved']] as const).map(([key, label]) => (
            <button key={key} type="button" className={styles.chip} aria-pressed={chip === key} onClick={() => setChip(chip === key ? null : key)}>
              {t(label)}<span className={styles.count}>{rows.filter(chipTest[key]).length}</span>
            </button>
          ))}
        </div>
        {phone ? (
          <ul className={styles.skuCards}>
            {visible.map((row) => (
              <li key={row.variantId} data-variant-id={row.variantId}>
                <span className={styles.medium}>{row.name}</span>
                <span className={styles.sub}>{[row.wholesalerName, row.cell, row.barcode].filter(Boolean).join(' · ')}</span>
                {lotCell(row)}
                <span className={styles.skuNumbers}>
                  <span>{t('inb.stock.col.onHand')} <strong>{row.onHand}</strong></span>
                  <span>{t('inb.stock.col.reserved')} <strong>{row.reserved}</strong></span>
                  <span>{t('inb.stock.col.available')} {availableCell(row)}</span>
                  <span>{t('inb.stock.col.defect')} <strong>{row.defect}</strong></span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('inb.stock.col.product')}</th>
                  <th>{t('inb.stock.col.cell')}</th>
                  <th>{t('inb.stock.col.lot')}</th>
                  <th className={styles.num}>{t('inb.stock.col.onHand')}</th>
                  <th className={styles.num}>{t('inb.stock.col.reserved')}</th>
                  <th className={styles.num}>{t('inb.stock.col.available')}</th>
                  <th className={styles.num}>{t('inb.stock.col.defect')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.variantId} data-variant-id={row.variantId}>
                    <td><span className={styles.stack}><span className={styles.strong}>{row.name}</span><span className={styles.sub}>{row.wholesalerName ?? '—'}</span></span></td>
                    <td><span className={styles.stack}><span className={styles.medium}>{row.cell ?? '—'}</span><span className={styles.sub}>{row.barcode ?? '—'}</span></span></td>
                    <td>{lotCell(row)}</td>
                    <td className={styles.num}>{row.onHand}</td>
                    <td className={styles.num}>{row.reserved ? <span className={styles.reservedLink}>{row.reserved}</span> : 0}</td>
                    <td className={styles.num}>{availableCell(row)}</td>
                    <td className={styles.num}>{row.defect}</td>
                  </tr>
                ))}
              </tbody>
              {visible.length ? (
                <tfoot>
                  <tr>
                    <td colSpan={3}>{t('inb.stock.total', { count: visible.length })}</td>
                    <td className={styles.num}>{sum('onHand', visible)}</td>
                    <td className={styles.num}>{sum('reserved', visible)}</td>
                    <td className={styles.num}>{sum('available', visible)}</td>
                    <td className={styles.num}>{sum('defect', visible)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
        {visible.length ? null : <p className={styles.empty}>{t('inb.stock.empty')}</p>}
        <p className={styles.footnote}>
          <strong>{t('inb.stock.noteOnHand')}</strong> {t('inb.stock.noteOnHandText')} <strong>{t('inb.stock.noteAvailable')}</strong> {t('inb.stock.noteAvailableText')}
        </p>
      </section>

      <div className={styles.pair}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>{t('inb.stock.reservedTitle')}</h2>
            <span>{t('inb.stock.reservedCardSub', { total: sum('reserved'), today: sum('reservedToday'), tomorrow: sum('reservedTomorrow') })}</span>
          </div>
          {reservedRows.length ? (
            <ul className={styles.list}>
              {reservedRows.map((row) => (
                <li key={row.variantId}>
                  <span className={styles.stack}>
                    <span className={styles.strong}>{row.name}</span>
                    <span className={styles.sub}>{[row.reservedToday ? t('inb.stock.waveToday', { count: row.reservedToday }) : null, row.reservedTomorrow ? t('inb.stock.waveTomorrow', { count: row.reservedTomorrow }) : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={styles.bigNumber}>{row.reserved}<span> {t('inb.unit')}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}>{t('inb.stock.noReserved')}</p>}
          <Link className={styles.more} to="/warehouse/picking">{t('inb.stock.toPicking')}<ChevronRight aria-hidden /></Link>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeadRow}>
            <h2>{t('inb.stock.incomingTitle')}</h2>
            <span className={styles.bigNumber}>{incomingQuantity}<span> {t('inb.unit')}</span></span>
          </div>
          {awaiting.length ? (
            <ul className={styles.list}>
              {awaiting.map((item) => (
                <li key={item.id}>
                  <span className={styles.stack}>
                    <span className={styles.strong}>{item.number} · {item.sku.name}</span>
                    <span className={styles.sub}>
                      {item.receivingStartedAt
                        ? t('inb.stock.incomingCounting', { count: item.declared, accepted: item.accepted, defect: item.defect })
                        : item.expectedAt === today
                          ? t('inb.stock.incomingToday', { count: item.declared })
                          : t('inb.stock.incomingDate', { count: item.declared, date: item.expectedAt === addDays(today, 1) ? `${t('inb.wait.tomorrow')}, ${isoToDots(item.expectedAt)}` : isoToDots(item.expectedAt) })}
                    </span>
                  </span>
                  <span className={styles.badgeStack}>
                    <StatusBadge family="shipment" code={item.status} />
                    {item.receivingStartedAt ? <span className={styles.sub}>{t('inb.stock.counting')}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className={styles.empty}>{t('inb.stock.noIncoming')}</p>}
          <Link className={styles.more} to="/warehouse">{t('inb.stock.toInbound')}<ChevronRight aria-hidden /></Link>
        </section>
      </div>
    </>
  );
}
