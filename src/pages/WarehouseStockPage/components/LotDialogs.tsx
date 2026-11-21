import { App, Button } from 'antd';
import { CircleX, PackageX, ShieldCheck, Undo2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReturnLotMutation, useWriteOffLotMutation } from '../../../features/inbound/api/inboundQueries';
import { daysLeft } from '../../../features/inbound/lib/expiry';
import type { StockLot, WriteOffPayload } from '../../../features/inbound/model/inboundTypes';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDate } from '../../../shared/lib/tashkentTime';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import styles from './LotDialogs.module.css';

interface LotDialogProps {
  lot: StockLot | null;
  phone: boolean;
  onClose: () => void;
  onDone: () => void;
}

function useQuantity(lot: StockLot | null) {
  const [raw, setRaw] = useState<string | null>(null);
  const value = raw ?? String(lot?.quantity ?? '');
  const amount = Number(value);
  const tooMany = lot !== null && amount > lot.quantity;
  const invalid = !value || !Number.isInteger(amount) || amount < 1 || tooMany;
  return { value, amount, tooMany, invalid, set: (next: string) => setRaw(next.replace(/\D/g, '').slice(0, 6)), reset: () => setRaw(null) };
}

const expiryText = (t: ReturnType<typeof useTranslation>['t'], lot: StockLot) => {
  const left = daysLeft(lot.expiresAt, tashkentDate());
  return `${isoToDots(lot.expiresAt)} · ${left < 0 ? t('inb.muddat.overdue', { days: -left }) : t('inb.muddat.left', { days: left })}`;
};

/** «Hisobdan chiqarish» (ombor-muddat 4): miqdor (partiyadan ko'p emas), sabab, izoh majburiy; audit jurnaliga yoziladi. */
export function WriteOffDialog({ lot, phone, onClose, onDone }: LotDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const writeOff = useWriteOffLotMutation();
  const id = useId();
  const quantity = useQuantity(lot);
  const [reason, setReason] = useState<WriteOffPayload['reason']>('EXPIRED');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const close = () => {
    quantity.reset();
    setNote('');
    setTouched(false);
    onClose();
  };
  const submit = () => {
    setTouched(true);
    if (!lot || quantity.invalid || !note.trim() || writeOff.isPending) return;
    writeOff.mutate({ id: lot.id, quantity: quantity.amount, reason, note: note.trim() }, {
      onSuccess: () => {
        notification.success({ title: t('inb.writeOff.done'), description: t('inb.writeOff.doneText', { lot: lot.number, count: quantity.amount }), placement: phone ? 'top' : 'bottomRight', duration: 4 });
        quantity.reset();
        setNote('');
        setTouched(false);
        onDone();
      },
      onError: (error) => notification.error({ title: t('inb.writeOff.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };
  return (
    <Dialog
      open={lot !== null}
      title={t('inb.writeOff.title')}
      description={t('inb.writeOff.sub')}
      icon={<PackageX size={20} />}
      tone="danger"
      width={480}
      locked={writeOff.isPending}
      onClose={close}
      testId="write-off-dialog"
      footer={(
        <>
          <DialogCancel onClick={close} disabled={writeOff.isPending}>{t('inb.writeOff.cancel')}</DialogCancel>
          <DialogPrimary danger shortcut={false} saving={writeOff.isPending} disabled={quantity.tooMany} onClick={submit}>{t('inb.writeOff.submit')}</DialogPrimary>
        </>
      )}
    >
      {lot ? (
        <>
          <dl className={styles.facts}>
            <div><dt>{t('inb.writeOff.lot')}</dt><dd>{lot.number} · {lot.sku.name}</dd></div>
            <div><dt>{t('inb.writeOff.wholesaler')}</dt><dd>{lot.wholesaler.name}</dd></div>
            <div><dt>{t('inb.writeOff.expiry')}</dt><dd>{expiryText(t, lot)}</dd></div>
            <div><dt>{t('inb.writeOff.onHand')}</dt><dd>{t('inb.pieces', { count: lot.quantity })}</dd></div>
          </dl>
          <div>
            <label className={styles.label} htmlFor={`${id}-q`}>{t('inb.writeOff.quantity')} <span className={styles.required}>*</span></label>
            <div className={styles.qty} aria-invalid={quantity.tooMany || (touched && quantity.invalid) || undefined}>
              <input id={`${id}-q`} inputMode="numeric" value={quantity.value} onChange={(event) => quantity.set(event.target.value)} />
              <span>{t('inb.unit')}</span>
            </div>
            {quantity.tooMany
              ? <p className={styles.error}><CircleX aria-hidden />{t('inb.writeOff.tooMany', { count: lot.quantity })}</p>
              : <p className={styles.hint}>{t('inb.writeOff.all', { count: lot.quantity })}</p>}
          </div>
          <div>
            <label className={styles.label} htmlFor={`${id}-r`}>{t('inb.writeOff.reason')} <span className={styles.required}>*</span></label>
            <SearchSelect id={`${id}-r`} label={t('inb.writeOff.reason')} value={reason} placeholder={t('inb.writeOff.reason')} searchable={false}
              options={(['EXPIRED', 'DAMAGED', 'OTHER'] as const).map((value) => ({ value, label: t(`inb.writeOff.reason.${value}`) }))}
              onChange={(value) => setReason(value as WriteOffPayload['reason'])} />
          </div>
          <div>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor={`${id}-n`}>{t('inb.writeOff.note')}</label>
              <span>{t('inb.writeOff.required')}</span>
            </div>
            <textarea id={`${id}-n`} className={styles.textarea} aria-invalid={(touched && !note.trim()) || undefined} maxLength={500} placeholder={t('inb.writeOff.notePlaceholder')} value={note} onChange={(event) => setNote(event.target.value)} />
            {touched && !note.trim() ? <p className={styles.error}><CircleX aria-hidden />{t('inb.writeOff.noteRequired')}</p> : null}
          </div>
          <dl className={styles.facts}>
            <div><dt>{lot.number}</dt><dd>{t('inb.writeOff.result', { from: lot.quantity, to: Math.max(0, lot.quantity - (quantity.invalid ? 0 : quantity.amount)) })}</dd></div>
            <div><dt>{t('inb.writeOff.money')}</dt><dd className={styles.muted}>{t('inb.writeOff.moneyTbd')}</dd></div>
          </dl>
          <p className={styles.audit}><ShieldCheck aria-hidden />{t('inb.writeOff.who')} <span className={styles.muted}>{t('inb.muddat.decision')}</span>. {t('inb.writeOff.audit')}</p>
        </>
      ) : null}
    </Dialog>
  );
}

/** «Optovikka qaytarish» (ombor-muddat 4): akt yaratmaydi — partiya «Optovikka topshirish» ro'yxatiga tushadi (FE-18). */
export function ReturnLotDialog({ lot, phone, onClose, onDone }: LotDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const returnLot = useReturnLotMutation();
  const id = useId();
  const quantity = useQuantity(lot);
  const [note, setNote] = useState('');
  const close = () => {
    quantity.reset();
    setNote('');
    onClose();
  };
  const submit = () => {
    if (!lot || quantity.invalid || returnLot.isPending) return;
    returnLot.mutate({ id: lot.id, quantity: quantity.amount, note: note.trim() || undefined }, {
      onSuccess: () => {
        const key = `return-${lot.id}`;
        notification.success({
          key,
          title: t('inb.return.done'),
          description: t('inb.return.doneText', { lot: lot.number, count: quantity.amount, wholesaler: lot.wholesaler.name }),
          placement: phone ? 'top' : 'bottomRight',
          duration: 6,
          actions: <Button size="small" onClick={() => { notification.destroy(key); void navigate('/warehouse/wholesaler-handover'); }}>{t('inb.return.toHandover')}</Button>,
        });
        quantity.reset();
        setNote('');
        onDone();
      },
      onError: (error) => notification.error({ title: t('inb.return.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };
  return (
    <Dialog
      open={lot !== null}
      title={t('inb.return.title')}
      description={t('inb.return.sub')}
      icon={<Undo2 size={20} />}
      width={480}
      locked={returnLot.isPending}
      onClose={close}
      testId="return-lot-dialog"
      footer={(
        <>
          <DialogCancel onClick={close} disabled={returnLot.isPending}>{t('inb.writeOff.cancel')}</DialogCancel>
          <DialogPrimary shortcut={false} saving={returnLot.isPending} disabled={quantity.tooMany} onClick={submit}>{t('inb.return.submit')}</DialogPrimary>
        </>
      )}
    >
      {lot ? (
        <>
          <dl className={styles.facts}>
            <div><dt>{t('inb.writeOff.lot')}</dt><dd>{lot.number} · {lot.sku.name}</dd></div>
            <div><dt>{t('inb.writeOff.wholesaler')}</dt><dd>{lot.wholesaler.name}</dd></div>
            <div><dt>{t('inb.return.reason')}</dt><dd>{t('inb.return.reasonValue', { state: t(`inb.lotState.${lot.state}`), date: isoToDots(lot.expiresAt) })}</dd></div>
          </dl>
          <div>
            <label className={styles.label} htmlFor={`${id}-q`}>{t('inb.writeOff.quantity')}</label>
            <div className={styles.qty} aria-invalid={quantity.tooMany || undefined}>
              <input id={`${id}-q`} inputMode="numeric" value={quantity.value} onChange={(event) => quantity.set(event.target.value)} />
              <span>{t('inb.unit')}</span>
            </div>
            {quantity.tooMany ? <p className={styles.error}><CircleX aria-hidden />{t('inb.writeOff.tooMany', { count: lot.quantity })}</p> : <p className={styles.hint}>{t('inb.writeOff.all', { count: lot.quantity })}</p>}
          </div>
          <div>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor={`${id}-n`}>{t('inb.writeOff.note')}</label>
              <span>{t('inb.form.optional')}</span>
            </div>
            <textarea id={`${id}-n`} className={styles.textarea} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <p className={styles.hint}>{t('inb.return.rule')}</p>
        </>
      ) : null}
    </Dialog>
  );
}
