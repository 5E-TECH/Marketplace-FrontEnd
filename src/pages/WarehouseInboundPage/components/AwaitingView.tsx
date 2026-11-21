import { Download, FilePlus, PackagePlus } from 'lucide-react';
import { inboundActPath } from '../../../features/inbound/lib/shipmentLabels';
import type { InboundShipment } from '../../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { addDays, tashkentClock } from '../../../shared/lib/tashkentTime';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../WarehouseInboundPage.module.css';

interface AwaitingViewProps {
  phone: boolean;
  awaiting: readonly InboundShipment[];
  done: readonly InboundShipment[];
  today: string;
  /** Skan bir nechta postavkaga mos keldi — ular belgilanadi. */
  matched: readonly string[];
  /** Yaqindagi (birinchi) postavka — asosiy tugma, qolganlari ikkinchi darajali. */
  starting: string | null;
  onStart: (shipment: InboundShipment) => void;
  onUndeclared: () => void;
  /** Yangi yakunlangan postavka — «Bugun qabul qilingan»da belgilangan. */
  lastDone: string | null;
}

/** Qabul boshlanmagan (ombor-qabul holatlar 1): kutilayotgan postavkalar va bugun qabul qilinganlar (akt PDF bilan). */
export function AwaitingView({ phone, awaiting, done, today, matched, starting, onStart, onUndeclared, lastDone }: AwaitingViewProps) {
  const { t } = useTranslation();
  const quantity = awaiting.reduce((sum, item) => sum + item.declared, 0);
  const when = (shipment: InboundShipment) => (shipment.expectedAt === today ? t('inb.wait.today') : shipment.expectedAt === addDays(today, 1) ? t('inb.wait.tomorrow') : null);
  const totals = done.reduce((sum, item) => ({ declared: sum.declared + item.declared, accepted: sum.accepted + item.accepted, defect: sum.defect + item.defect }), { declared: 0, accepted: 0, defect: 0 });
  const startButton = (shipment: InboundShipment, index: number) => (
    <button
      type="button"
      className={index === 0 ? styles.primary : styles.secondary}
      aria-label={t('inb.wait.startAria', { number: shipment.number })}
      disabled={starting !== null}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onStart(shipment)}
    >
      {t('inb.wait.start')}
    </button>
  );
  const undeclared = (
    <button type="button" className={styles.secondary} onMouseDown={(event) => event.preventDefault()} onClick={onUndeclared}>
      <FilePlus aria-hidden />{t('inb.queue.undeclared')}
    </button>
  );

  return (
    <>
      <section className={styles.card} data-testid="awaiting-list">
        <div className={styles.listHead}>
          <div className={styles.cardTitle}>
            <h2>{t('inb.queue.title')}</h2>
            <span>{t('inb.queue.sub', { count: awaiting.length, quantity })}</span>
          </div>
          {phone ? null : undeclared}
        </div>
        {phone && awaiting.length ? undeclared : null}
        {!awaiting.length ? (
          <div className={styles.emptyBlock}>
            <span aria-hidden><PackagePlus /></span>
            <strong>{t('inb.wait.emptyTitle')}</strong>
            <p>{t('inb.wait.emptyText')}</p>
            {undeclared}
          </div>
        ) : phone ? (
          <ul className={styles.waitCards}>
            {awaiting.map((shipment, index) => (
              <li key={shipment.id} data-matched={matched.includes(shipment.id) || undefined} data-shipment-id={shipment.id}>
                <span className={styles.queueTop}>
                  <span className={styles.queueNumber}>{shipment.number}</span>
                  <StatusBadge family="shipment" code={shipment.status} />
                </span>
                <span className={styles.waitName}>{shipment.sku.name} <span>· {shipment.wholesaler.name}</span></span>
                <span className={styles.waitMeta}>
                  <span>{[isoToDots(shipment.expectedAt), when(shipment)].filter(Boolean).join(' · ')}</span>
                  <strong>{t('inb.pieces', { count: shipment.declared })}</strong>
                </span>
                <span className={styles.waitAction}>{startButton(shipment, index)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.scroll}>
            <table className={`${styles.table} ${styles.listTable}`}>
              <thead>
                <tr>
                  <th>{t('inb.wait.col.number')}</th>
                  <th>{t('inb.wait.col.product')}</th>
                  <th>{t('inb.wait.col.expected')}</th>
                  <th className={styles.num}>{t('inb.wait.col.declared')}</th>
                  <th>{t('inb.wait.col.status')}</th>
                  <th><span className={styles.visuallyHidden}>{t('inb.wait.start')}</span></th>
                </tr>
              </thead>
              <tbody>
                {awaiting.map((shipment, index) => (
                  <tr key={shipment.id} data-current={matched.includes(shipment.id) || undefined} data-shipment-id={shipment.id}>
                    <td><strong>{shipment.number}</strong></td>
                    <td><span className={styles.stack}><span>{shipment.sku.name}</span><span>{shipment.wholesaler.name}</span></span></td>
                    <td><span className={styles.stack}><span>{isoToDots(shipment.expectedAt)}</span><span>{when(shipment)}</span></span></td>
                    <td className={styles.num}>{shipment.declared}</td>
                    <td><StatusBadge family="shipment" code={shipment.status} /></td>
                    <td className={styles.actionCell}>{startButton(shipment, index)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card} data-testid="done-list">
        <div className={styles.cardTitle}>
          <h2>{t('inb.done.title')}</h2>
          <span>{t('inb.done.sub', { count: done.length, ...totals })}</span>
        </div>
        {!done.length ? <p className={styles.empty}>{t('inb.done.empty')}</p> : phone ? (
          <ul className={styles.waitCards}>
            {done.map((shipment) => (
              <li key={shipment.id} data-matched={shipment.id === lastDone || undefined}>
                <span className={styles.queueTop}>
                  <span className={styles.queueNumber}>{shipment.number}</span>
                  <StatusBadge family="shipment" code={shipment.status} />
                </span>
                <span className={styles.waitName}>{shipment.sku.name}</span>
                <span className={styles.waitMeta}>
                  <span>{t('inb.done.phoneMeta', { time: shipment.completedAt ? tashkentClock(Date.parse(shipment.completedAt)) : '—', declared: shipment.declared, accepted: shipment.accepted, defect: shipment.defect })}</span>
                  <a className={styles.pdf} href={inboundActPath(shipment.id)} target="_blank" rel="noopener">PDF<Download aria-hidden /></a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.scroll}>
            <table className={`${styles.table} ${styles.listTable}`}>
              <thead>
                <tr>
                  <th>{t('inb.wait.col.number')}</th>
                  <th>{t('inb.wait.col.product')}</th>
                  <th>{t('inb.done.col.completed')}</th>
                  <th className={styles.num}>{t('inb.done.col.numbers')}</th>
                  <th>{t('inb.wait.col.status')}</th>
                  <th className={styles.num}>{t('inb.done.col.act')}</th>
                </tr>
              </thead>
              <tbody>
                {done.map((shipment) => (
                  <tr key={shipment.id} data-current={shipment.id === lastDone || undefined} data-shipment-id={shipment.id}>
                    <td><strong>{shipment.number}</strong></td>
                    <td>{shipment.sku.name}</td>
                    <td>{shipment.completedAt ? tashkentClock(Date.parse(shipment.completedAt)) : '—'}</td>
                    <td className={styles.num}>{shipment.declared} · {shipment.accepted} · {shipment.defect}</td>
                    <td><StatusBadge family="shipment" code={shipment.status} /></td>
                    <td className={styles.num}><a className={styles.pdf} href={inboundActPath(shipment.id)} target="_blank" rel="noopener">PDF<Download aria-hidden /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
