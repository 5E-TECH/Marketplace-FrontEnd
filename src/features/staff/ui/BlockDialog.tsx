import { App } from 'antd';
import { Ban, CirclePause, Inbox, LogOut, PhoneCall } from 'lucide-react';
import { useId, useState } from 'react';
import { ROLE_LABEL_KEYS } from '../../auth/lib/roleLabels';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { rich } from '../../../shared/i18n/richText';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useBlockUserMutation, useOperatorsLiveQuery } from '../api/staffQueries';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { displayName } from '../lib/staffFormat';
import type { UserAccount } from '../model/staffTypes';
import { AccountStatusBadge, PersonSummary } from './StaffBadges';
import styles from './staffUi.module.css';

const REASON_MAX = 500;

/**
 * Bloklash tasdig'i (admin-foydalanuvchilar «Bloklash tasdig‘i», karta D3): oqibatlar — sessiya darhol tugaydi
 * (backend: keyingi so'rov 401), operatorda softfon o'chadi; «Sabab *» majburiy (taklif: auditga yoziladi, fe-15 §5).
 */
export function BlockDialog({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const block = useBlockUserMutation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const reasonId = useId();
  const hintId = useId();
  const name = displayName(user);
  const operator = user.role === 'OPERATOR_LEAD';
  const seller = user.role === 'AFFILIATE';
  // Operator: hozirgi holat va bronlar (admin-foydalanuvchilar.holatlar «Bloklash tasdig‘i»; BE-13 queue-summary).
  const operators = useOperatorsLiveQuery(operator);
  const live = operator ? operators.data?.find((item) => item.operatorId === user.id) ?? null : null;
  const presence = !live ? null
    : live.since ? t('staff.block.presence', { state: t(`staff.block.state.${live.state}`), time: tashkentClock(Date.parse(live.since)) }) : t(`staff.block.state.${live.state}`);
  const invalid = touched && !reason.trim();

  const submit = () => {
    setTouched(true);
    if (!reason.trim() || block.isPending) return;
    block.mutate({ id: user.id, reason }, {
      onSuccess: () => {
        notification.success({
          title: t('staff.toast.blocked', { name }),
          description: t(operator ? 'staff.toast.blockedOperatorText' : seller ? 'staff.toast.blockedSellerText' : 'staff.toast.blockedText'),
          placement: phone ? 'top' : 'bottomRight',
          duration: 5,
        });
        onClose();
      },
      onError: (error) => notification.error({ title: t('staff.block.failedTitle'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
    });
  };

  return (
    <Dialog
      open
      title={t('staff.block.title', { name })}
      description={t(seller ? 'staff.block.subSeller' : 'staff.block.sub')}
      icon={<Ban />}
      tone="danger"
      width={440}
      locked={block.isPending}
      onClose={onClose}
      testId="staff-block-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={block.isPending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={block.isPending} savingLabel={t('staff.block.saving')} shortcut={false} icon={<Ban />} danger>{t('staff.block.confirm')}</DialogPrimary>
        </>
      )}
    >
      <PersonSummary
        name={user.name || user.phone}
        title={name}
        sub={[user.role ? t(ROLE_LABEL_KEYS[user.role]) : t('staff.status.unknownRole'), user.code, presence].filter(Boolean).join(' · ')}
        badge={<AccountStatusBadge user={user} />}
      />
      <div className={styles.consequences}>
        <ul>
          <li><LogOut aria-hidden /><span>{rich(t('staff.block.session'), { strong: <strong>{t('staff.block.sessionStrong')}</strong> })}</span></li>
          {operator ? <li><PhoneCall aria-hidden /><span>{t('staff.block.softphone')}</span></li> : null}
          {seller ? <li><CirclePause aria-hidden /><span>{t('staff.block.pages')}</span></li> : null}
          {live ? (
            <li>
              <Inbox aria-hidden />
              <span>{t('staff.block.bookings', { bookings: live.activeBookings, scheduled: live.scheduledCalls ? t('staff.block.scheduled', { count: live.scheduledCalls }) : t('staff.block.noScheduled') })}</span>
            </li>
          ) : null}
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
          maxLength={REASON_MAX}
          placeholder={t('staff.block.reasonPlaceholder')}
          required
          autoFocus
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
          onChange={(event) => setReason(event.target.value)}
        />
        <p id={hintId} className={invalid ? styles.error : styles.hint}>{t(invalid ? 'staff.block.reasonRequired' : 'staff.block.reasonHint')}</p>
      </div>
    </Dialog>
  );
}
