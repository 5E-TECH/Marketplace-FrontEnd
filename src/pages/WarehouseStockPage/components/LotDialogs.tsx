import { App } from 'antd';
import { CircleX, PackageX, ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { useWriteOffLotMutation } from '../../../features/inbound/api/inboundQueries';
import { daysLeft } from '../../../features/inbound/lib/expiry';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDate } from '../../../shared/lib/tashkentTime';
import { isoToDots } from '../../../shared/ui/DateInput/dateInput';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import type { LotView } from '../lotView';
import styles from './LotDialogs.module.css';

const REASONS = ['EXPIRED', 'DAMAGED', 'OTHER'] as const;
type Reason = (typeof REASONS)[number];

interface LotDialogProps {
  lot: LotView | null;
  phone: boolean;
  onClose: () => void;
  onDone: () => void;
}

function useQuantity(lot: LotView | null) {
  const [raw, setRaw] = useState<string | null>(null);
  const value = raw ?? String(lot?.quantity ?? '');
  const amount = Number(value);
  const tooMany = lot !== null && amount > lot.quantity;
  const invalid = !value || !Number.isInteger(amount) || amount < 1 || tooMany;
  return { value, amount, tooMany, invalid, set: (next: string) => setRaw(next.replace(/\D/g, '').slice(0, 6)), reset: () => setRaw(null) };
}

const expiryText = (t: ReturnType<typeof useTranslation>['t'], lot: LotView) => {
  const left = daysLeft(lot.expiryDate, tashkentDate());
  return `${isoToDots(lot.expiryDate)} · ${left < 0 ? t('inb.muddat.overdue', { days: -left }) : t('inb.muddat.left', { days: left })}`;
};

/**
 * «Hisobdan chiqarish» (ombor-muddat 4): miqdor (partiyadan ko'p emas), sabab, izoh majburiy. BE-16/BE-17 tuzatish
 * (`adjust`, manfiy, aniq partiya `lotId` bilan); sabab va izoh `reason` ga yoziladi, audit jurnaliga tushadi.
 */
export function WriteOffDialog({ lot, phone, onClose, onDone }: LotDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const writeOff = useWriteOffLotMutation();
  const id = useId();
  const quantity = useQuantity(lot);
  const [reason, setReason] = useState<Reason>('EXPIRED');
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
    writeOff.mutate({ variantId: lot.variantId, lotId: lot.id, quantity: quantity.amount, reason: `${t(`inb.writeOff.reason.${reason}`)}: ${note.trim()}` }, {
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
            <div><dt>{t('inb.writeOff.lot')}</dt><dd>{lot.number} · {lot.productName}</dd></div>
            <div><dt>{t('inb.writeOff.wholesaler')}</dt><dd>{lot.wholesalerName ?? '—'}</dd></div>
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
              options={REASONS.map((value) => ({ value, label: t(`inb.writeOff.reason.${value}`) }))}
              onChange={(value) => setReason(REASONS.find((item) => item === value) ?? 'EXPIRED')} />
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
