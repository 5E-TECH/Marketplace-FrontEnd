import { Ban, CircleCheck, CircleMinus, Plus, TriangleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { daysLeft } from '../../../features/inbound/lib/expiry';
import { shipmentTally } from '../../../features/inbound/lib/scanRules';
import type { InboundShipment } from '../../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../WarehouseInboundPage.module.css';

export interface Counts {
  declared: number;
  accepted: number;
  defect: number;
}

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

interface ReceivingCardProps {
  shipment: InboundShipment;
  counts: Counts;
  phone: boolean;
  /** Muddatli tovar: «Yangi partiya» (qadoqdagi sana boshqacha). */
  onNewLot?: () => void;
  /** Partiyalar jadvali — muddatli tovarda (4-qism). */
  lots?: ReactNode;
  /** Sotuvdan chiqarilgan partiyalardagi son — chiziqda alohida (to'q sariq). */
  blocked?: number;
}

/** Qabul kartasi (ombor-qabul): mahsulot · optovik, e'lon / qabul / brak (ortiq yoki kam), sanoq chizig'i, partiya. */
export function ReceivingCard({ shipment, counts, phone, onNewLot, lots, blocked = 0 }: ReceivingCardProps) {
  const { t } = useTranslation();
  const tally = shipmentTally(counts);
  const cells = [
    { key: 'declared', label: t('inb.recv.declared'), note: t('inb.recv.declaredNote'), value: String(counts.declared), swatch: null },
    { key: 'accepted', label: t('inb.recv.accepted'), note: t('inb.recv.acceptedNote'), value: String(counts.accepted), swatch: 'accepted' },
    { key: 'defect', label: t('inb.recv.defect'), note: t('inb.recv.defectNote'), value: String(counts.defect), swatch: 'defect' },
    ...(tally.surplus ? [{ key: 'surplus', label: t('inb.recv.surplus'), note: t('inb.recv.surplusNote'), value: `+${tally.surplus}`, swatch: null, tone: 'warning' }] : []),
    ...(tally.shortage && counts.accepted + counts.defect > 0 ? [{ key: 'shortage', label: t('inb.recv.shortage'), note: t('inb.recv.shortageNote'), value: String(tally.shortage), swatch: null, tone: 'warning' }] : []),
  ];
  const total = Math.max(counts.declared, tally.counted);
  const right = tally.surplus
    ? <span data-tone="warning">{t('inb.recv.surplusCount', { count: tally.surplus })}</span>
    : tally.shortage
      ? <span data-tone="warning">{t('inb.recv.shortageCount', { count: tally.shortage })}</span>
      : <span>{t('inb.recv.exact')}</span>;

  return (
    <section className={`${styles.card} ${styles.receiving}`} data-testid="receiving-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2>{shipment.sku.name} · {shipment.wholesaler.name}</h2>
          <span>{t('inb.recv.sub', { number: shipment.number, date: isoToDots(shipment.expectedAt) })}</span>
          {shipment.sku.expiryTracked ? <span>{t('inb.lots.tracked', { category: shipment.sku.categoryName ?? '—' })}</span> : null}
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

      {lots ?? (
        <dl className={styles.facts}>
          <div><dt>{t('inb.recv.lot')}</dt><dd>{shipment.lots[0]?.number ?? shipment.number}</dd></div>
          <div><dt>{t('inb.recv.expiry')}</dt><dd>{t('inb.recv.expiryNotTracked', { category: shipment.sku.categoryName ?? '—' })}</dd></div>
          <div><dt>{t('inb.recv.place')}</dt><dd>{shipment.sku.cell ? t('inb.recv.placeValue', { cell: shipment.sku.cell }) : '—'}</dd></div>
        </dl>
      )}
      {onNewLot ? (
        <div className={styles.factsAction}>
          <button type="button" className={styles.linkButton} onMouseDown={(event) => event.preventDefault()} onClick={onNewLot}><Plus aria-hidden />{t('inb.recv.newLot')}</button>
        </div>
      ) : null}
    </section>
  );
}

/** Muddatli tovar partiyalari (ombor-qabul holatlar 3 «Natija»): muddat va qolgan kun, qabul, sotuv holati. */
export function LotsTable({ shipment, today }: { shipment: InboundShipment; today: string }) {
  const { t } = useTranslation();
  const lots = shipment.lots.filter((lot) => lot.expiresAt);
  if (!lots.length) return <p className={styles.hint}>{t('inb.lots.none')}</p>;
  return (
    <>
      <div className={styles.scroll}>
        <table className={styles.table} data-testid="lots-table">
          <caption className={styles.visuallyHidden}>{t('inb.lots.title')}</caption>
          <thead>
            <tr>
              <th>{t('inb.lots.col.lot')}</th>
              <th>{t('inb.lots.col.expiry')}</th>
              <th className={styles.num}>{t('inb.lots.col.qty')}</th>
              <th>{t('inb.lots.col.sale')}</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const left = daysLeft(lot.expiresAt ?? today, today);
              return (
                <tr key={lot.id} data-lot={lot.number}>
                  <td><strong>{lot.number}</strong></td>
                  <td>{isoToDots(lot.expiresAt)} · <span className={lot.sellable ? undefined : styles.diffNegative}>{t('inb.lots.days', { days: left })}</span></td>
                  <td className={styles.num}>{lot.quantity}</td>
                  <td>{lot.sellable
                    ? <Badge tone="success" icon={CircleCheck}>{t('inb.lots.onSale')}</Badge>
                    : <Badge tone="danger" icon={Ban}>{t('inb.lots.blocked')}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lots.filter((lot) => !lot.sellable).map((lot) => (
        <div key={lot.id} className={styles.notice} data-tone="warning" data-testid="lot-blocked">
          <div className={styles.noticeBody}>
            <TriangleAlert aria-hidden />
            <p><strong>{t('inb.lots.blockedTitle', { lot: lot.number })}</strong>{t('inb.lots.blockedText')}</p>
          </div>
        </div>
      ))}
    </>
  );
}

interface ActCardProps {
  shipment: InboundShipment;
  counts: Counts;
  phone: boolean;
  receiver: string;
  today: string;
  note: string;
  onNoteChange: (note: string) => void;
  onFinish: () => void;
  /** Navbatdagi skanlar yuborilmagan — yakunlash yopiq (umumiy-aloqa-uzildi 4). */
  queued: number;
}

/** «Farq akti» (ombor-qabul): sonlar jadvali, kimga va kim qabul qildi, aktga izoh, «Qabulni yakunlash». */
export function ActCard({ shipment, counts, phone, receiver, today, note, onNoteChange, onFinish, queued }: ActCardProps) {
  const { t } = useTranslation();
  const id = useId();
  const tally = shipmentTally(counts);
  const exact = tally.diff === 0 && counts.defect === 0 && tally.surplus === 0;
  const diffClass = tally.diff < 0 ? styles.diffNegative : tally.diff > 0 ? styles.diffPositive : undefined;
  return (
    <section className={`${styles.card} ${styles.actCard}`} data-testid="act-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2>{t('inb.recv.actTitle')}</h2>
          <span>{t(exact ? 'inb.recv.actSubExact' : 'inb.recv.actSub')}</span>
        </div>
        <div className={styles.chips}><Badge tone="neutral" icon={CircleMinus}>{t('inb.recv.notSent')}</Badge></div>
      </div>
      {phone ? (
        <div className={styles.actPhone}>
          <div className={styles.stack}>
            <span>{shipment.sku.name}</span>
            <span>{[shipment.sku.barcode, shipment.number].filter(Boolean).join(' · ')}</span>
          </div>
          <div className={styles.actGrid}>
            <div><span>{t('inb.recv.col.declared')}</span><strong>{counts.declared}</strong></div>
            <div><span>{t('inb.recv.col.accepted')}</span><strong>{counts.accepted}</strong></div>
            <div><span>{t('inb.recv.col.defect')}</span><strong>{counts.defect}</strong></div>
            <div><span>{t('inb.recv.col.diffCount')}</span><strong>{signed(tally.counted - counts.declared)}</strong></div>
            <div className={styles.actDiff} data-negative={tally.diff < 0 || undefined}><span>{t('inb.recv.col.diff')}</span><strong>{signed(tally.diff)}</strong></div>
          </div>
        </div>
      ) : (
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
              <tr>
                <td><span className={styles.stack}><span>{shipment.sku.name}</span><span>{shipment.sku.barcode ?? '—'}</span></span></td>
                <td className={styles.num}>{counts.declared}</td>
                <td className={styles.num}>{counts.accepted}</td>
                <td className={styles.num}>{counts.defect}</td>
                <td className={styles.num}>{signed(tally.counted - counts.declared)}</td>
                <td className={styles.num}><span className={diffClass}>{signed(tally.diff)}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.pair}>
        <div><p>{t('inb.recv.to')}</p><p>{t('inb.recv.toValue', { name: shipment.wholesaler.name })}</p></div>
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
          maxLength={500}
          placeholder={t(tally.shortage ? 'inb.recv.notePlaceholderShort' : 'inb.recv.notePlaceholder')}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </div>
      <div className={styles.actFooter}>
        <p>{queued ? t('inb.recv.queueBlocked', { count: queued }) : t('inb.recv.finishHint')}</p>
        {phone ? null : (
          <button type="button" className={styles.primary} data-size="large" disabled={queued > 0} title={queued ? t('inb.recv.queueBlockedTitle') : undefined} onClick={onFinish}>
            {t('inb.recv.finish')}
          </button>
        )}
      </div>
    </section>
  );
}
