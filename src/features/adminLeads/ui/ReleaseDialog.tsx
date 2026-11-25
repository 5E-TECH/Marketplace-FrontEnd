import { App } from 'antd';
import { LockOpen } from 'lucide-react';
import { useId, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { useNow } from '../../../shared/lib/useNow';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useReleaseBookingMutation } from '../api/adminLeadsQueries';
import type { AdminLeadCard } from '../model/adminLeadTypes';
import styles from './LeadDialogs.module.css';

interface ReleaseDialogProps {
  lead: Pick<AdminLeadCard, 'id' | 'customerName' | 'bookedUntil' | 'operator'>;
  onClose: () => void;
}

const left = (until: string | null, now: number) => {
  const seconds = until ? Math.max(0, Math.floor((Date.parse(until) - now) / 1000)) : 0;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

/**
 * «Bronni bo'shatish» (admin-lid-karta, xavfli tasdiq; taklif `POST /admin/leads/{id}/release`): faqat admin, sabab
 * majburiy; lid navbatga qaytadi va keyingi bo'sh operatorga beriladi. Operator suhbatda bo'lsa — ogohlantirish.
 */
export function ReleaseDialog({ lead, onClose }: ReleaseDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const now = useNow();
  const reasonId = useId();
  const errorId = useId();
  const release = useReleaseBookingMutation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const invalid = touched && !trimmed;
  const operator = lead.operator?.name ?? '—';

  const submit = () => {
    setTouched(true);
    if (!trimmed || release.isPending) return;
    release.mutate({ id: lead.id, reason: trimmed }, {
      onSuccess: () => {
        notification.success({ title: t('alk.rl.done', { id: lead.id }), description: t('alk.rl.doneText'), placement: phone ? 'top' : 'bottomRight', duration: 5 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('alk.rl.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  return (
    <Dialog
      open
      title={t('alk.rl.title')}
      description={t('alk.rl.desc')}
      icon={<LockOpen />}
      tone="danger"
      locked={release.isPending}
      onClose={onClose}
      testId="release-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={release.isPending}>{t('al.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={release.isPending} savingLabel={t('alk.rl.saving')} shortcut={false} danger icon={<LockOpen />} disabled={invalid}>
            {t('alk.rl.submit')}
          </DialogPrimary>
        </>
      )}
    >
      <div className={styles.body} role="alertdialog" aria-label={t('alk.rl.title')}>
        <div className={styles.leads}>
          <ul>
            <li>
              <span className={styles.leadName}><span className={styles.leadId}>{lead.id}</span><span>{lead.customerName}</span></span>
              <span className={styles.leadState}>{t('alk.rl.row', { operator, left: left(lead.bookedUntil, now) })}</span>
            </li>
          </ul>
        </div>
        <div className={styles.box}>
          <p>{t('alk.rl.text')}{lead.operator?.inCall ? ` ${t('alk.rl.inCall', { operator })}` : ''}</p>
        </div>
        <div>
          <div className={styles.labelRow}>
            <label htmlFor={reasonId}>{t('alk.rl.reason')} <span className={styles.required} aria-hidden>*</span></label>
          </div>
          <textarea
            id={reasonId}
            className={styles.textarea}
            value={reason}
            maxLength={500}
            required
            autoFocus
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            onChange={(event) => setReason(event.target.value)}
          />
          {invalid ? <p id={errorId} className={styles.error}>{t('alk.rl.reasonError')}</p> : null}
        </div>
      </div>
    </Dialog>
  );
}
