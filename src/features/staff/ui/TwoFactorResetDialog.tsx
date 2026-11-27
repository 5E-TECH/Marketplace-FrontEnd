import { App } from 'antd';
import { LogOut, RotateCcw, Smartphone } from 'lucide-react';
import { useId, useState } from 'react';
import { ROLE_LABEL_KEYS } from '../../auth/lib/roleLabels';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { rich } from '../../../shared/i18n/richText';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useResetTwoFactorMutation } from '../api/staffQueries';
import { displayName } from '../lib/staffFormat';
import type { UserAccount } from '../model/staffTypes';
import { AccountStatusBadge, PersonSummary } from './StaffBadges';
import styles from './staffUi.module.css';

/**
 * «2FA ni tiklash» (admin-foydalanuvchi-karta D5; BE-26 `POST /admin/users/{id}/2fa/reset`, faqat superadmin): eski
 * kod va zaxira kodlar bekor, hamma sessiya tugaydi, keyingi kirishda QR bilan qayta ulanadi (FE-27). Sabab — taklif.
 */
export function TwoFactorResetDialog({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const reset = useResetTwoFactorMutation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const reasonId = useId();
  const hintId = useId();
  const name = displayName(user);
  const role = user.role ? t(ROLE_LABEL_KEYS[user.role]) : t('staff.status.unknownRole');
  const invalid = touched && !reason.trim();

  const submit = () => {
    setTouched(true);
    if (!reason.trim() || reset.isPending) return;
    reset.mutate({ id: user.id, reason }, {
      onSuccess: () => {
        notification.success({ title: t('staff.tfaReset.toast', { name }), description: t('staff.tfaReset.toastText'), placement: phone ? 'top' : 'bottomRight', duration: 5 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('staff.tfaReset.failed'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  return (
    <Dialog
      open
      title={t('staff.tfaReset.title', { name })}
      description={t('staff.tfaReset.sub')}
      icon={<RotateCcw />}
      tone="danger"
      width={440}
      locked={reset.isPending}
      onClose={onClose}
      testId="staff-tfa-reset-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={reset.isPending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={reset.isPending} savingLabel={t('staff.tfaReset.saving')} shortcut={false} danger>{t('staff.tfaReset.submit')}</DialogPrimary>
        </>
      )}
    >
      <PersonSummary
        name={user.name || user.phone}
        title={`${name} · ${user.code}`}
        sub={user.totpEnabledAt ? t('staff.tfaReset.person', { role, date: tashkentDay(user.totpEnabledAt) }) : t('staff.tfaReset.personNone', { role })}
        badge={<AccountStatusBadge user={user} />}
      />
      <div className={styles.consequences}>
        <ul>
          <li><Smartphone aria-hidden /><span>{rich(t('staff.tfaReset.code'), { strong: <strong>{t('staff.tfaReset.codeStrong')}</strong> })}</span></li>
          <li><LogOut aria-hidden /><span>{t('staff.tfaReset.sessions')}</span></li>
          <li><RotateCcw aria-hidden /><span>{t('staff.tfaReset.next')}</span></li>
        </ul>
      </div>
      <div>
        <div className={styles.labelRow}>
          <label htmlFor={reasonId}>{t('staff.block.reason')} <span className={styles.required} aria-hidden>*</span></label>
        </div>
        <textarea
          id={reasonId}
          className={styles.textarea}
          value={reason}
          maxLength={500}
          required
          autoFocus
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
          onChange={(event) => setReason(event.target.value)}
        />
        <p id={hintId} className={invalid ? styles.error : styles.hint}>{t(invalid ? 'staff.block.reasonRequired' : 'staff.tfaReset.hint')}</p>
      </div>
    </Dialog>
  );
}
