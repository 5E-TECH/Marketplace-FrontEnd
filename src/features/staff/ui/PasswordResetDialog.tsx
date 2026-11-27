import { App } from 'antd';
import { KeyRound } from 'lucide-react';
import { useId, useState } from 'react';
import { ROLE_LABEL_KEYS } from '../../auth/lib/roleLabels';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatUzPhone } from '../../../shared/lib/phone';
import { tashkentDate } from '../../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useResetPasswordMutation, useUserLoginsQuery } from '../api/staffQueries';
import { displayName, lastLoginText } from '../lib/staffFormat';
import type { PasswordDelivery, UserAccount } from '../model/staffTypes';
import { AccountStatusBadge, PersonSummary } from './StaffBadges';
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog';
import styles from './staffUi.module.css';

const OPTIONS: readonly PasswordDelivery[] = ['SMS', 'SHOW'];

/**
 * «Parolni tiklash» (admin-foydalanuvchi-karta D4; taklif `POST /admin/users/{id}/password/reset`, fe-15 §6):
 * vaqtinchalik parol SMS bilan yoki adminga bir marta ko'rsatiladi; eski parol va hamma sessiya darhol tugaydi.
 */
export function PasswordResetDialog({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const reset = useResetPasswordMutation();
  const [delivery, setDelivery] = useState<PasswordDelivery>('SMS');
  const [shown, setShown] = useState<string | null>(null);
  const groupId = useId();
  const logins = useUserLoginsQuery(user.id);
  const name = displayName(user);
  const role = user.role ? t(ROLE_LABEL_KEYS[user.role]) : t('staff.status.unknownRole');
  // Kirishlar tarixida bugungi oxirgi urinish muvaffaqiyatsiz — «bugun kira olmadi» (D4 namunasi).
  const latest = logins.data?.[0];
  const failedToday = Boolean(latest && latest.outcome !== 'SUCCESS' && tashkentDate(Date.parse(latest.at)) === tashkentDate());

  if (shown) return <TemporaryPasswordDialog name={name} code={user.code} password={shown} noSms={false} onClose={onClose} />;

  const submit = () => {
    if (reset.isPending) return;
    reset.mutate({ id: user.id, delivery }, {
      onSuccess: (result) => {
        if (result.temporaryPassword && !result.smsSent) {
          setShown(result.temporaryPassword);
          return;
        }
        notification.success({ title: t('staff.pw.toast'), description: t('staff.pw.toastSms', { name }), placement: phone ? 'top' : 'bottomRight', duration: 5 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('staff.pw.failed'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  const sub = user.lastLoginAt
    ? t('staff.pw.person', { role, phone: formatUzPhone(user.phone), when: lastLoginText(user.lastLoginAt, t) })
    : t('staff.pw.personNever', { role, phone: formatUzPhone(user.phone) });

  return (
    <Dialog
      open
      title={t('staff.pw.title')}
      description={t(failedToday ? 'staff.pw.subFailed' : 'staff.pw.sub', { name })}
      icon={<KeyRound />}
      locked={reset.isPending}
      onClose={onClose}
      testId="staff-password-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={reset.isPending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={reset.isPending} savingLabel={t('staff.pw.saving')} shortcut={false}>{t('staff.pw.submit')}</DialogPrimary>
        </>
      )}
    >
      <PersonSummary name={user.name || user.phone} title={`${name} · ${user.code}`} sub={sub} badge={<AccountStatusBadge user={user} />} />
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('staff.pw.legend')}</legend>
        <div className={styles.options}>
          {OPTIONS.map((value) => {
            const selected = delivery === value;
            const id = `${groupId}-${value}`;
            return (
              <div key={value} className={styles.option} data-selected={selected || undefined}>
                <div className={styles.optionRow}>
                  <label htmlFor={id} className={styles.optionLabel}>
                    <span className={styles.radio}>
                      <input type="radio" id={id} name={groupId} checked={selected} aria-describedby={selected ? `${id}-d` : undefined} onChange={() => setDelivery(value)} />
                      <span />
                    </span>
                    <span className={styles.optionName}>{t(value === 'SMS' ? 'staff.pw.sms' : 'staff.pw.show')}</span>
                  </label>
                </div>
                {selected ? <p id={`${id}-d`} className={styles.optionText}>{t(value === 'SMS' ? 'staff.pw.smsText' : 'staff.pw.showText')}</p> : null}
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.facts}>
        <dl>
          <div><dt>{t('staff.pw.sessions')}</dt><dd>{t('staff.pw.sessionsValue')}</dd></div>
          <div><dt>{t('staff.pw.old')}</dt><dd>{t('staff.pw.oldValue')}</dd></div>
          <div><dt>{t('staff.pw.policy')}</dt><dd><span className={styles.placeholder}>{t('staff.pw.policyValue')}</span></dd></div>
        </dl>
      </div>
    </Dialog>
  );
}
