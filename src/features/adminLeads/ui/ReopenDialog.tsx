import { App, Button } from 'antd';
import { RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useReopenLeadMutation } from '../api/adminLeadsQueries';
import { leadDayTime, withinDays } from '../lib/leadRows';
import type { AdminLeadListItem } from '../model/adminLeadTypes';
import styles from './LeadDialogs.module.css';

type ReopenLead = Pick<AdminLeadListItem, 'id' | 'customerName' | 'productName' | 'streamCode' | 'affiliateName' | 'rejectedAt' | 'operatorName' | 'closedNote'>;

interface ReopenDialogProps {
  lead: ReopenLead;
  onClose: () => void;
  /** Toastdagi «Lidni ochish». */
  onOpenLead?: (id: string) => void;
}

const REASON_MAX = 500;

/**
 * «{Lid} ni qayta ochish» (admin-lidlar, admin-lid-karta; BE-35): faqat admin, faqat «Rad etildi», sabab majburiy.
 * Lid navbatga «Yangi» bo'lib qaytadi — urinishlar 0 dan, yangi 3 kunlik aloqa muddati; tarixga kim, qachon, sabab.
 */
export function ReopenDialog({ lead, onClose, onOpenLead }: ReopenDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const reasonId = useId();
  const errorId = useId();
  const reopen = useReopenLeadMutation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const invalid = touched && !trimmed;
  const rejectedAt = lead.rejectedAt ? leadDayTime(lead.rejectedAt, t).replace(/^\p{Lu}/u, (letter) => letter.toLocaleLowerCase()) : null;

  const submit = () => {
    setTouched(true);
    if (!trimmed || reopen.isPending) return;
    reopen.mutate({ id: lead.id, reason: trimmed }, {
      onSuccess: () => {
        const key = `reopen-${lead.id}`;
        notification.success({
          key,
          title: t('al.ro.done', { id: lead.id }),
          description: t('al.ro.doneText'),
          placement: phone ? 'top' : 'bottomRight',
          duration: 6,
          actions: onOpenLead ? (
            <Button size="small" onClick={() => { notification.destroy(key); onOpenLead(lead.id); }}>{t('al.ro.openLead')}</Button>
          ) : undefined,
        });
        onClose();
      },
      onError: (error) => notification.error({ title: t('al.ro.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  return (
    <Dialog
      open
      title={t('al.ro.title', { id: lead.id })}
      description={t('al.ro.desc', { product: lead.productName, stream: lead.streamCode ?? '—', affiliate: lead.affiliateName ?? '—' })}
      icon={<RotateCcw />}
      locked={reopen.isPending}
      onClose={onClose}
      testId="reopen-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={reopen.isPending}>{t('al.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={reopen.isPending} savingLabel={t('al.ro.saving')} shortcut={false} icon={<RotateCcw />} disabled={invalid}>
            {t('al.ro.submit')}
          </DialogPrimary>
        </>
      )}
    >
      <div className={styles.body}>
        <dl className={styles.facts}>
          <div><dt>{t('al.ro.lead')}</dt><dd>{lead.id} · {lead.customerName}</dd></div>
          {rejectedAt ? <div><dt>{t('al.ro.rejected')}</dt><dd>{lead.operatorName ? `${rejectedAt} · ${lead.operatorName}` : rejectedAt}</dd></div> : null}
          {lead.closedNote ? <div><dt>{t('al.ro.reason')}</dt><dd>{lead.closedNote}</dd></div> : null}
        </dl>
        <div className={styles.box}>
          <p>{t(!lead.rejectedAt || withinDays(lead.rejectedAt, 3) ? 'al.ro.noteRecent' : 'al.ro.noteOld')}</p>
        </div>
        <div>
          <div className={styles.labelRow}>
            <label htmlFor={reasonId}>{t('al.ro.reason')} <span className={styles.required} aria-hidden>*</span></label>
          </div>
          <textarea
            id={reasonId}
            className={styles.textarea}
            value={reason}
            maxLength={REASON_MAX}
            required
            autoFocus
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            onChange={(event) => setReason(event.target.value)}
          />
          {invalid ? <p id={errorId} className={styles.error}>{t('al.ro.reasonError')}</p> : null}
        </div>
        <div className={styles.after}>
          <p>{t('al.ro.after')}</p>
          <dl>
            <div><dt>{t('al.ro.afterStatus')}</dt><dd>{t('status.lead.NEW')}</dd></div>
            <div><dt>{t('al.ro.afterQueue')}</dt><dd>{t('al.ro.afterQueueValue')}</dd></div>
            <div><dt>{t('al.ro.afterHistory')}</dt><dd>{t('al.ro.afterHistoryValue')}</dd></div>
          </dl>
        </div>
      </div>
    </Dialog>
  );
}
