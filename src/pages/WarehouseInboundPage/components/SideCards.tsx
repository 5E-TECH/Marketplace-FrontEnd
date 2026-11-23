import { CircleMinus, FilePlus, RotateCcw, TriangleAlert } from 'lucide-react';
import { shipmentTitle } from '../../../features/inbound/lib/shipmentLabels';
import type { InboundShipment } from '../../../features/inbound/model/inboundTypes';
import type { JournalEntry } from '../../../features/inbound/model/receivingDraft';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { addDays, tashkentClock } from '../../../shared/lib/tashkentTime';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../WarehouseInboundPage.module.css';

const time = (iso: string) => tashkentClock(Date.parse(iso));

interface JournalProps {
  shipment: InboundShipment;
  entries: readonly JournalEntry[];
  total: number;
  canUndo: boolean;
  onUndo: () => void;
}

/** «Skan jurnali» (ombor-qabul): oxirgi skanlar yangisi tepada, natijasi bilan; oxirgi hisoblangan skanni bekor qilish. */
export function ScanJournal({ shipment, entries, total, canUndo, onUndo }: JournalProps) {
  const { t } = useTranslation();
  const row = (entry: JournalEntry) => {
    switch (entry.kind) {
      case 'DUPLICATE':
        return {
          title: <><CircleMinus aria-hidden />{t('inb.journal.duplicate')}</>,
          sub: t('inb.journal.duplicateText', { code: entry.barcode }),
          result: <span className={styles.journalResult}>—</span>,
        };
      case 'UNKNOWN':
      case 'FOREIGN':
        return {
          title: <><TriangleAlert aria-hidden data-tone="warning" />{t(entry.kind === 'UNKNOWN' ? 'inb.journal.unknown' : 'inb.journal.foreign')}</>,
          sub: entry.kind === 'UNKNOWN'
            ? t('inb.journal.unknownText', { code: entry.barcode })
            : t('inb.journal.foreignText', { code: entry.barcode, product: entry.productName ?? '', number: entry.otherShipment ?? '' }),
          result: <span className={styles.journalResult} data-tone="warning">{t('inb.journal.notWritten')}</span>,
        };
      default: {
        const accepted = entry.kind === 'ACCEPTED';
        return {
          title: <>{entry.productName}</>,
          sub: accepted ? entry.barcode : t('inb.journal.defectMode', { code: entry.barcode }),
          result: <span className={styles.journalResult} data-tone={accepted ? 'success' : 'danger'}>{t(accepted ? 'inb.journal.accepted' : 'inb.journal.defect', { count: entry.total ?? 0 })}</span>,
        };
      }
    }
  };

  return (
    <section className={`${styles.card} ${styles.journalCard}`} data-tight data-testid="scan-journal">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2>{t('inb.journal.title')}</h2>
          <span>{t('inb.journal.sub', { number: shipment.number, count: total })}</span>
        </div>
      </div>
      {entries.length ? (
        <ol className={styles.journal} aria-label={t('inb.journal.aria')}>
          {entries.slice(0, 5).map((entry) => {
            const item = row(entry);
            return (
              <li key={entry.key}>
                <span className={styles.journalTime}>{time(entry.at)}</span>
                <span className={styles.journalBody}>
                  <span className={styles.journalTitle}>{item.title}</span>
                  <span className={styles.journalSub}>{item.sub}</span>
                </span>
                {item.result}
              </li>
            );
          })}
        </ol>
      ) : <p className={styles.empty}>{t('inb.journal.empty')}</p>}
      <button type="button" className={styles.linkButton} disabled={!canUndo} onMouseDown={(event) => event.preventDefault()} onClick={onUndo}>
        <RotateCcw aria-hidden />{t('inb.journal.undo')}
      </button>
    </section>
  );
}

interface QueueProps {
  current: InboundShipment | null;
  awaiting: readonly InboundShipment[];
  done: readonly InboundShipment[];
  /** Shu qurilmada qabuli boshlangan postavkalar. */
  started: ReadonlySet<string>;
  today: string;
  onOpen: (shipment: InboundShipment) => void;
  onUndeclared: () => void;
}

/** O'ng ustun «Kutilayotgan postavkalar» (ombor-qabul): joriy postavka belgilangan, bugun qabul qilinganlar, arizasiz postavka. */
export function QueueCard({ current, awaiting, done, started, today, onOpen, onUndeclared }: QueueProps) {
  const { t } = useTranslation();
  const quantity = awaiting.reduce((sum, item) => sum + item.declared, 0);
  const sub = (shipment: InboundShipment) => {
    if (started.has(shipment.id)) return t('inb.queue.inProgress', { count: shipment.declared });
    if (shipment.expectedAt === today) return t('inb.queue.today', { count: shipment.declared });
    if (shipment.expectedAt === addDays(today, 1)) return t('inb.queue.tomorrow', { count: shipment.declared, date: isoToDots(shipment.expectedAt) });
    return t('inb.queue.date', { count: shipment.declared, date: isoToDots(shipment.expectedAt) });
  };
  const item = (shipment: InboundShipment, subline: string, isCurrent = false) => (
    <li key={shipment.id}>
      <button
        type="button"
        className={styles.queueItem}
        aria-current={isCurrent || undefined}
        aria-label={isCurrent ? undefined : t('inb.queue.open', { number: shipment.number })}
        disabled={isCurrent || Boolean(shipment.receivedAt)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onOpen(shipment)}
      >
        <span className={styles.queueTop}>
          <span className={styles.queueNumber}>{shipment.number}</span>
          <StatusBadge family="shipment" code={shipment.status} />
        </span>
        <span className={styles.queueName}>{shipmentTitle(t, shipment)}</span>
        <span className={styles.queueSub}>{subline}</span>
      </button>
    </li>
  );
  return (
    <section className={`${styles.card} ${styles.queueCard}`} data-tight data-testid="queue-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2>{t('inb.queue.title')}</h2>
          <span>{t('inb.queue.sub', { count: awaiting.length, quantity })}</span>
        </div>
      </div>
      <ul className={styles.queue} aria-label={t('inb.queue.title')}>
        {awaiting.map((shipment) => item(shipment, sub(shipment), shipment.id === current?.id))}
      </ul>
      {done.length ? (
        <>
          <p className={styles.queueCaption}>{t('inb.queue.doneTitle')}</p>
          <ul className={styles.queue} aria-label={t('inb.done.title')}>
            {done.map((shipment) => item(shipment, t(shipment.status === 'RECEIVED' ? 'inb.queue.doneExact' : 'inb.queue.doneDiff', {
              accepted: shipment.accepted, declared: shipment.declared, time: shipment.receivedAt ? time(shipment.receivedAt) : '—',
            })))}
          </ul>
        </>
      ) : null}
      <button type="button" className={`${styles.secondary} ${styles.block}`} onClick={onUndeclared}><FilePlus aria-hidden />{t('inb.queue.undeclared')}</button>
    </section>
  );
}
