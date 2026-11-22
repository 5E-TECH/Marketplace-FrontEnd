import { App } from 'antd';
import { CalendarClock, CircleX, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { useCreateLotMutation } from '../../../features/inbound/api/inboundQueries';
import { daysLeft, isSellableExpiry, saleCutoff } from '../../../features/inbound/lib/expiry';
import type { InboundShipment } from '../../../features/inbound/model/inboundTypes';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { DateInput } from '../../../shared/ui/DateInput/DateInput';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import styles from './LotDialog.module.css';

export interface LotRequest {
  /** Birinchi skan (kod partiya saqlangach yoziladi) yoki «Yangi partiya». */
  code: string | null;
}

interface LotDialogProps {
  shipment: InboundShipment;
  request: LotRequest | null;
  today: string;
  onClose: () => void;
  onSaved: (lotId: string, code: string | null) => void;
}

/**
 * «Partiya va yaroqlilik muddati» (ombor-qabul holatlar 3; OMB-3, tz.md G11): BAD, kosmetika, oziq-ovqatda
 * birinchi skanda so'raladi. Muddatiga 60 kundan kam qolsa — partiya qoldiqqa kiradi, sotuvga chiqmaydi (TC4).
 */
export function LotDialog({ shipment, request, today, onClose, onSaved }: LotDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const createLot = useCreateLotMutation();
  const id = useId();
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const number = `${shipment.number}-${shipment.lots.filter((lot) => lot.expiresAt).length + 1}`;
  const first = !shipment.lots.some((lot) => lot.expiresAt);
  const left = expiresAt ? daysLeft(expiresAt, today) : null;
  const expired = left !== null && left < 0;
  const blocked = expiresAt !== null && !expired && !isSellableExpiry(expiresAt, today);
  const missing = touched && !expiresAt;

  const save = () => {
    setTouched(true);
    if (!expiresAt || expired || createLot.isPending) return;
    createLot.mutate({ id: shipment.id, number, expiresAt }, {
      onSuccess: (next) => {
        const lot = next.lots.find((item) => item.number === number);
        if (lot) onSaved(lot.id, request?.code ?? null);
        setExpiresAt(null);
        setTouched(false);
      },
      onError: (error) => notification.error({ title: t('inb.lot.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  const close = () => {
    setExpiresAt(null);
    setTouched(false);
    onClose();
  };

  return (
    <Dialog
      open={request !== null}
      title={t('inb.lot.title')}
      description={t(first ? 'inb.lot.subFirst' : 'inb.lot.subNew', { product: shipment.sku.name })}
      icon={<CalendarClock size={20} />}
      width={480}
      locked={createLot.isPending}
      onClose={close}
      testId="lot-dialog"
      footer={(
        <>
          <DialogCancel onClick={close} disabled={createLot.isPending}>{t('inb.lot.cancel')}</DialogCancel>
          <DialogPrimary shortcut={false} saving={createLot.isPending} disabled={expired} onClick={save}>{t('inb.lot.save')}</DialogPrimary>
        </>
      )}
    >
      <dl className={styles.facts}>
        <div><dt>{t('inb.lot.product')}</dt><dd>{[shipment.sku.name, shipment.sku.categoryName].filter(Boolean).join(' · ')}</dd></div>
        <div><dt>{t('inb.lot.barcode')}</dt><dd>{shipment.sku.barcode ?? '—'}</dd></div>
        <div><dt>{t('inb.lot.shipment')}</dt><dd>{shipment.number} · {shipment.wholesaler.name}</dd></div>
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
