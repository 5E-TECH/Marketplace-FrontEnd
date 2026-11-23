import { CalendarClock, CircleMinus, TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { daysLeft, isSellableExpiry } from '../../../features/inbound/lib/expiry';
import { shipmentTally } from '../../../features/inbound/lib/scanRules';
import { shipmentTitle, wholesalerLabel } from '../../../features/inbound/lib/shipmentLabels';
import type { InboundShipment, ShipmentItem } from '../../../features/inbound/model/inboundTypes';
import type { DraftLot } from '../../../features/inbound/model/receivingDraft';
import type { ItemCounts } from '../../../features/inbound/model/useReceiving';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../WarehouseInboundPage.module.css';

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

/** Qator holati: sanoq, partiya (qoralamada) va yacheyka. */
export interface ItemView {
  item: ShipmentItem;
  counts: ItemCounts;
  lot: DraftLot | null;
  cell: string;
  /** Yacheyka qoldiqdan ma'lum — yakunlashda so'ralmaydi. */
  cellKnown: boolean;
}

/** Partiya muddati: «12.01.2027 · 50 kun» va sotuvga chiqadimi (60 kun qoidasi). */
function LotLine({ lot, today }: { lot: DraftLot; today: string }) {
  const { t } = useTranslation();
  const sellable = isSellableExpiry(lot.expiryDate, today);
  return (
    <span className={styles.stack}>
      <span>{lot.batch} · {isoToDots(lot.expiryDate)}</span>
      <span className={sellable ? undefined : styles.diffNegative}>
        {t('inb.lots.days', { days: daysLeft(lot.expiryDate, today) })} · {t(sellable ? 'inb.lots.onSale' : 'inb.lots.blocked')}
      </span>
    </span>
  );
}

interface ReceivingCardProps {
  shipment: InboundShipment;
  counts: ItemCounts;
  items: readonly ItemView[];
  phone: boolean;
  today: string;
  /** Sotuvdan chiqariladigan (60 kundan kam muddatli) qabul — chiziqda alohida. */
  blocked: number;
  /** «Partiya va muddat» (muddatli tovarda birinchi skanda so'raladi, boshqasida ixtiyoriy). */
  onLot: (item: ShipmentItem) => void;
}

/** Qabul kartasi (ombor-qabul): mahsulot · optovik, e'lon / qabul / brak (ortiq yoki kam), sanoq chizig'i, partiya. */
export function ReceivingCard({ shipment, counts, items, phone, today, blocked, onLot }: ReceivingCardProps) {
  const { t } = useTranslation();
  const tally = shipmentTally(counts);
  const cells = [
    { key: 'declared', label: t('inb.recv.declared'), note: t('inb.recv.declaredNote'), value: String(counts.declared), swatch: null },
    { key: 'accepted', label: t('inb.recv.accepted'), note: t('inb.recv.acceptedNote'), value: String(counts.accepted), swatch: 'accepted' },
    { key: 'defect', label: t('inb.recv.defect'), note: t('inb.recv.defectNote'), value: String(counts.defect), swatch: 'defect' },
    ...(tally.surplus ? [{ key: 'surplus', label: t('inb.recv.surplus'), note: t('inb.recv.surplusNote'), value: `+${tally.surplus}`, swatch: null, tone: 'warning' }] : []),
    ...(tally.shortage && tally.counted > 0 ? [{ key: 'shortage', label: t('inb.recv.shortage'), note: t('inb.recv.shortageNote'), value: String(tally.shortage), swatch: null, tone: 'warning' }] : []),
  ];
  const total = Math.max(counts.declared, tally.counted);
  const right = tally.surplus
    ? <span data-tone="warning">{t('inb.recv.surplusCount', { count: tally.surplus })}</span>
    : tally.shortage
      ? <span data-tone="warning">{t('inb.recv.shortageCount', { count: tally.shortage })}</span>
      : <span>{t('inb.recv.exact')}</span>;
  const single = items.length === 1 ? items[0] : null;
  const lotButton = (view: ItemView) => (
    <button type="button" className={styles.linkButton} onMouseDown={(event) => event.preventDefault()} onClick={() => onLot(view.item)}>
      <CalendarClock aria-hidden />{t(view.lot ? 'inb.recv.lotChange' : 'inb.recv.lotAdd')}
    </button>
  );

  return (
    <section className={`${styles.card} ${styles.receiving}`} data-testid="receiving-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2>{shipmentTitle(t, shipment)} · {wholesalerLabel(t, shipment)}</h2>
          <span>{t('inb.recv.sub', { number: shipment.number, date: isoToDots(shipment.expectedAt) })}</span>
          {single?.item.expiryTracked ? <span>{t('inb.lots.tracked')}</span> : null}
        </div>
        <div className={styles.chips}><StatusBadge family="shipment" code={shipment.status} /></div>
      </div>

      <dl className={styles.counts} data-testid="receiving-counts">
        {cells.map((cell) => (phone ? (
          <div key={cell.key} className={styles.count} data-count={cell.key}>
            <dt className={styles.countLabel}>
              <span className={styles.swatch} data-kind={cell.swatch ?? undefined} />
              <span className={styles.countText}><span>{cell.label}</span><span className={styles.countNote}>{cell.note}</span></span>
            </dt>
            <dd className={styles.countValue} data-tone={'tone' in cell ? cell.tone : undefined}>{cell.value}</dd>
          </div>
        ) : (
          <div key={cell.key} className={styles.count} data-count={cell.key}>
            <dt className={styles.countLabel}>{cell.swatch ? <span className={styles.swatch} data-kind={cell.swatch} /> : null}{cell.label}</dt>
            <dd className={styles.countValue} data-tone={'tone' in cell ? cell.tone : undefined}>{cell.value}</dd>
            <span className={styles.countNote}>{cell.note}</span>
          </div>
        )))}
      </dl>

      <div className={styles.progress}>
        <div className={styles.progressHead}>
          <span>{t('inb.recv.counted')} <strong data-testid="receiving-counted">{tally.counted} / {counts.declared}</strong></span>
          {right}
        </div>
        <div className={styles.bar} role="img" aria-label={t('inb.recv.barAria', { counted: tally.counted, declared: counts.declared, accepted: counts.accepted, defect: counts.defect })}>
          {counts.accepted - blocked > 0 ? <span data-kind="accepted" style={{ flex: `${counts.accepted - blocked} 1 0px` }} /> : null}
          {blocked ? <span data-kind="surplus" style={{ flex: `${blocked} 1 0px` }} /> : null}
          {counts.defect ? <span data-kind="defect" style={{ flex: `${counts.defect} 1 0px` }} /> : null}
          {tally.surplus ? <span data-kind="surplus" style={{ flex: `${tally.surplus} 1 0px` }} /> : null}
          {tally.shortage ? <span data-kind="rest" style={{ flex: `${tally.shortage} 1 0px` }} /> : null}
          {total === 0 ? <span data-kind="rest" style={{ flex: '1 1 0px' }} /> : null}
        </div>
      </div>

      {tally.surplus ? (
        <div className={styles.notice} data-tone="warning">
          <div className={styles.noticeBody}>
            <TriangleAlert aria-hidden />
            <p><strong>{t('inb.recv.surplusTitle', { count: tally.surplus })}</strong>{t('inb.recv.surplusText', { count: tally.surplus })}</p>
          </div>
        </div>
      ) : null}
      {tally.shortage && tally.counted ? <p className={styles.hint}>{t('inb.recv.shortageText', { count: tally.shortage })}</p> : null}

      {single ? (
        <>
          <dl className={styles.facts} data-testid="receiving-facts">
            <div><dt>{t('inb.recv.lot')}</dt><dd>{single.lot?.batch ?? shipment.number}</dd></div>
            <div>
              <dt>{t('inb.recv.expiry')}</dt>
              <dd>{single.lot ? <LotLine lot={single.lot} today={today} /> : t(single.item.expiryTracked ? 'inb.recv.expiryMissing' : 'inb.recv.expiryNone')}</dd>
            </div>
            <div><dt>{t('inb.recv.place')}</dt><dd>{single.cell ? t('inb.recv.placeValue', { cell: single.cell }) : '—'}</dd></div>
          </dl>
          <div className={styles.factsAction}>{lotButton(single)}</div>
        </>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table} data-testid="receiving-items">
            <caption className={styles.visuallyHidden}>{t('inb.recv.itemsCaption', { number: shipment.number })}</caption>
            <thead>
              <tr>
                <th>{t('inb.recv.col.product')}</th>
                <th className={styles.num}>{t('inb.recv.col.declared')}</th>
                <th className={styles.num}>{t('inb.recv.col.accepted')}</th>
                <th className={styles.num}>{t('inb.recv.col.defect')}</th>
                <th>{t('inb.recv.expiry')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((view) => (
                <tr key={view.item.id} data-item-id={view.item.id}>
                  <td>
                    <span className={styles.stack}>
                      <span>{view.item.productName}</span>
                      <span>{[view.item.barcode, view.cell].filter(Boolean).join(' · ') || '—'}</span>
                    </span>
                  </td>
                  <td className={styles.num}>{view.counts.declared}</td>
                  <td className={styles.num}>{view.counts.accepted}</td>
                  <td className={styles.num}>{view.counts.defect}</td>
                  <td>{view.lot ? <LotLine lot={view.lot} today={today} /> : lotButton(view)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.filter((view) => view.lot && !isSellableExpiry(view.lot.expiryDate, today)).map((view) => (
        <div key={view.item.id} className={styles.notice} data-tone="warning" data-testid="lot-blocked">
          <div className={styles.noticeBody}>
            <TriangleAlert aria-hidden />
            <p><strong>{t('inb.lots.blockedTitle', { lot: view.lot?.batch ?? '' })}</strong>{t('inb.lots.blockedText')}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

interface ActCardProps {
  shipment: InboundShipment;
  counts: ItemCounts;
  items: readonly ItemView[];
  phone: boolean;
  receiver: string;
  today: string;
  note: string;
  onNoteChange: (note: string) => void;
  onFinish: () => void;
  /** Aloqa yo'q — yakunlash yopiq: akt tizimdagi sonlar bilan tuziladi. */
  offline: boolean;
}

/** «Farq akti» (ombor-qabul): sonlar jadvali, kimga va kim qabul qildi, aktga izoh, «Qabulni yakunlash». */
export function ActCard({ shipment, counts, items, phone, receiver, today, note, onNoteChange, onFinish, offline }: ActCardProps) {
  const { t } = useTranslation();
  const id = useId();
  const tally = shipmentTally(counts);
  const exact = tally.diff === 0 && counts.defect === 0 && tally.surplus === 0;
  const diffClass = (value: number) => (value < 0 ? styles.diffNegative : value > 0 ? styles.diffPositive : undefined);
  const row = (view: ItemView) => {
    const line = shipmentTally(view.counts);
    return { counted: signed(line.counted - view.counts.declared), diff: line.diff };
  };
  return (
    <section className={`${styles.card} ${styles.actCard}`} data-testid="act-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2>{t('inb.recv.actTitle')}</h2>
          <span>{t(exact ? 'inb.recv.actSubExact' : 'inb.recv.actSub')}</span>
        </div>
        <div className={styles.chips}><Badge tone="neutral" icon={CircleMinus}>{t('inb.recv.notSent')}</Badge></div>
      </div>
      {phone ? items.map((view) => (
        <div key={view.item.id} className={styles.actPhone}>
          <div className={styles.stack}>
            <span>{view.item.productName}</span>
            <span>{[view.item.barcode, shipment.number].filter(Boolean).join(' · ')}</span>
          </div>
          <div className={styles.actGrid}>
            <div><span>{t('inb.recv.col.declared')}</span><strong>{view.counts.declared}</strong></div>
            <div><span>{t('inb.recv.col.accepted')}</span><strong>{view.counts.accepted}</strong></div>
            <div><span>{t('inb.recv.col.defect')}</span><strong>{view.counts.defect}</strong></div>
            <div><span>{t('inb.recv.col.diffCount')}</span><strong>{row(view).counted}</strong></div>
            <div className={styles.actDiff} data-negative={row(view).diff < 0 || undefined}><span>{t('inb.recv.col.diff')}</span><strong>{signed(row(view).diff)}</strong></div>
          </div>
        </div>
      )) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>{t('inb.recv.actCaption', { number: shipment.number })}</caption>
            <thead>
              <tr>
                <th>{t('inb.recv.col.product')}</th>
                <th className={styles.num}>{t('inb.recv.col.declared')}</th>
                <th className={styles.num}>{t('inb.recv.col.accepted')}</th>
                <th className={styles.num}>{t('inb.recv.col.defect')}</th>
                <th className={styles.num}>{t('inb.recv.col.diffCount')}</th>
                <th className={styles.num}>{t('inb.recv.col.diff')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((view) => (
                <tr key={view.item.id}>
                  <td><span className={styles.stack}><span>{view.item.productName}</span><span>{view.item.barcode ?? '—'}</span></span></td>
                  <td className={styles.num}>{view.counts.declared}</td>
                  <td className={styles.num}>{view.counts.accepted}</td>
                  <td className={styles.num}>{view.counts.defect}</td>
                  <td className={styles.num}>{row(view).counted}</td>
                  <td className={styles.num}><span className={diffClass(row(view).diff)}>{signed(row(view).diff)}</span></td>
                </tr>
              ))}
            </tbody>
            {items.length > 1 ? (
              <tfoot>
                <tr>
                  <td>{t('inb.act.total')}</td>
                  <td className={styles.num}>{counts.declared}</td>
                  <td className={styles.num}>{counts.accepted}</td>
                  <td className={styles.num}>{counts.defect}</td>
                  <td className={styles.num}>{signed(tally.counted - counts.declared)}</td>
                  <td className={styles.num}><span className={diffClass(tally.diff)}>{signed(tally.diff)}</span></td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
      <div className={styles.pair}>
        <div><p>{t('inb.recv.to')}</p><p>{t('inb.recv.toValue', { name: wholesalerLabel(t, shipment) })}</p></div>
        <div><p>{t('inb.recv.by')}</p><p>{t('inb.recv.byValue', { name: receiver, date: isoToDots(today) })}</p></div>
      </div>
      <div>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor={`${id}-note`}>{t('inb.recv.note')}</label>
          <span className={styles.optional}>{t('inb.recv.optional')}</span>
        </div>
        <textarea
          id={`${id}-note`}
          className={styles.textarea}
          maxLength={1000}
          placeholder={t(tally.shortage ? 'inb.recv.notePlaceholderShort' : 'inb.recv.notePlaceholder')}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </div>
      <div className={styles.actFooter}>
        <p>{offline ? t('inb.recv.offlineBlocked') : t('inb.recv.finishHint')}</p>
        {phone ? null : (
          <button type="button" className={styles.primary} data-size="large" disabled={offline} title={offline ? t('inb.recv.offlineBlockedTitle') : undefined} onClick={onFinish}>
            {t('inb.recv.finish')}
          </button>
        )}
      </div>
    </section>
  );
}
