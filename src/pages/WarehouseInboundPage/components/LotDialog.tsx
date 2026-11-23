import { CalendarClock, CircleX, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { daysLeft, isSellableExpiry, saleCutoff } from '../../../features/inbound/lib/expiry';
import { wholesalerLabel } from '../../../features/inbound/lib/shipmentLabels';
import type { InboundShipment, ShipmentItem } from '../../../features/inbound/model/inboundTypes';
import type { DraftLot } from '../../../features/inbound/model/receivingDraft';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { DateInput } from '../../../shared/ui/DateInput/DateInput';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import styles from './LotDialog.module.css';

export interface LotRequest {
  item: ShipmentItem;
  /** Birinchi skan (kod partiya saqlangach hisoblanadi) yoki «Partiya va muddat» tugmasi. */
  code: string | null;
}

interface LotDialogProps {
  shipment: InboundShipment;
  request: LotRequest | null;
  /** Qatorning qoralamadagi partiyasi — o'zgartirishda. */
  current: DraftLot | null;
  today: string;
  onClose: () => void;
  onSaved: (item: ShipmentItem, lot: DraftLot, code: string | null) => void;
}

/**
 * «Partiya va yaroqlilik muddati» (ombor-qabul holatlar 3; OMB-3, tz.md G11): BAD, kosmetika, oziq-ovqatda
 * birinchi skanda so'raladi. Muddatiga 60 kundan kam qolsa — partiya qoldiqqa kiradi, sotuvga chiqmaydi (TC4).
 * Qabul bilan birga yuboriladi (BE-17 `receive`: qatorga bitta partiya).
 */
export function LotDialog({ shipment, request, current, today, onClose, onSaved }: LotDialogProps) {
  const { t } = useTranslation();
  const id = useId();
  const [expiresAt, setExpiresAt] = useState<string | null>(current?.expiryDate ?? null);
  const [touched, setTouched] = useState(false);
  const item = request?.item ?? null;
  const index = item ? shipment.items.findIndex((row) => row.id === item.id) : 0;
  const number = current?.batch ?? `${shipment.number}-${index + 1}`;
  const left = expiresAt ? daysLeft(expiresAt, today) : null;
  const expired = left !== null && left < 0;
  const blocked = expiresAt !== null && !expired && !isSellableExpiry(expiresAt, today);
  const missing = touched && !expiresAt;

  const save = () => {
    setTouched(true);
    if (!item || !expiresAt || expired) return;
    onSaved(item, { batch: number, expiryDate: expiresAt }, request?.code ?? null);
  };

  return (
    <Dialog
      open={request !== null}
      title={t('inb.lot.title')}
      description={t(request?.code ? 'inb.lot.subFirst' : 'inb.lot.subNew', { product: item?.productName ?? '' })}
      icon={<CalendarClock size={20} />}
      width={480}
      onClose={onClose}
      testId="lot-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose}>{t('inb.lot.cancel')}</DialogCancel>
          <DialogPrimary shortcut={false} disabled={expired} onClick={save}>{t('inb.lot.save')}</DialogPrimary>
        </>
      )}
    >
      <dl className={styles.facts}>
        <div><dt>{t('inb.lot.product')}</dt><dd>{item?.productName ?? '—'}</dd></div>
        <div><dt>{t('inb.lot.barcode')}</dt><dd>{item?.barcode ?? '—'}</dd></div>
        <div><dt>{t('inb.lot.shipment')}</dt><dd>{shipment.number} · {wholesalerLabel(t, shipment)}</dd></div>
      </dl>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-lot`}>{t('inb.lot.number')}</label>
        <input id={`${id}-lot`} className={styles.readonly} value={number} readOnly />
        <p className={styles.hint}>{t('inb.lot.numberHint')}</p>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-exp`}>{t('inb.lot.expiry')} <span className={styles.required}>*</span></label>
        <DateInput
          id={`${id}-exp`}
          className={`${styles.date} ${blocked ? styles.dateWarning : ''}`}
          value={expiresAt}
          min={today}
          status={missing || expired ? 'error' : undefined}
          onChange={setExpiresAt}
        />
        {missing ? <p className={styles.error}><CircleX aria-hidden />{t('inb.lot.expiryRequired')}</p>
          : expired ? <p className={styles.error}><CircleX aria-hidden />{t('inb.lot.expired')}</p>
            : blocked ? <p className={styles.warning}><TriangleAlert aria-hidden />{t('inb.lot.daysLeft', { days: left ?? 0 })}</p>
              : <p className={styles.hint}>{t('inb.lot.expiryHint', { date: isoToDots(saleCutoff(today)) })}</p>}
      </div>
      {blocked ? (
        <div className={styles.notice}>
          <TriangleAlert aria-hidden />
          <p><strong>{t('inb.lot.blockedTitle')}</strong>{t('inb.lot.blockedText')}</p>
        </div>
      ) : null}
    </Dialog>
  );
}
