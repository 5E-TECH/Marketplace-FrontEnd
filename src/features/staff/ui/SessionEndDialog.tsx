import { App } from 'antd';
import { Info, LogOut } from 'lucide-react';
import { ROLE_LABEL_KEYS } from '../../auth/lib/roleLabels';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useEndAllSessionsMutation, useEndSessionMutation } from '../api/staffQueries';
import { displayName } from '../lib/staffFormat';
import type { StaffSession, UserAccount } from '../model/staffTypes';
import { SessionRow } from './SessionRow';
import styles from './staffUi.module.css';

/**
 * «Sessiyani tugatasizmi?» (admin-foydalanuvchi-karta D6; taklif, fe-15 §7): bitta qurilma yoki «Hammasini tugatish»
 * (qator menyusidagi «Sessiyalarni tugatish» ham shu). O'sha qurilma keyingi so'rovda chiqadi.
 */
export function SessionEndDialog({ user, session, onClose }: { user: UserAccount; session: StaffSession | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const endOne = useEndSessionMutation();
  const endAll = useEndAllSessionsMutation();
  const pending = endOne.isPending || endAll.isPending;
  const name = displayName(user);
  const role = user.role ? t(ROLE_LABEL_KEYS[user.role]) : t('staff.status.unknownRole');
  const placement = phone ? 'top' : 'bottomRight';
  const onError = (error: unknown) => notification.error({ title: t('staff.sess.failed'), description: getApiErrorMessage(error), placement });

  const submit = () => {
    if (pending) return;
    if (session) {
      endOne.mutate({ id: user.id, sessionId: session.id }, {
        onSuccess: () => {
          notification.success({ title: t('staff.sess.toast'), description: t('staff.sess.toastText', { name, device: `${session.browser} · ${session.os}` }), placement, duration: 4 });
          onClose();
        },
        onError,
      });
      return;
    }
    endAll.mutate(user.id, {
      onSuccess: () => {
        notification.success({ title: t('staff.sess.toastAll'), description: t('staff.sess.toastAllText', { name }), placement, duration: 4 });
        onClose();
      },
      onError,
    });
  };

  return (
    <Dialog
      open
      title={t(session ? 'staff.sess.title' : 'staff.sess.allTitle')}
      description={t('staff.sess.sub', { name, role })}
      icon={<LogOut />}
      tone="danger"
      width={440}
      locked={pending}
      onClose={onClose}
      testId="staff-session-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={pending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={pending} savingLabel={t('staff.sess.saving')} shortcut={false} danger>
            {t(session ? 'staff.sess.submit' : 'staff.sess.submitAll')}
          </DialogPrimary>
        </>
      )}
    >
      {session ? <div className={styles.sessionBox}><SessionRow session={session} /></div> : null}
      <p className={styles.note}><Info aria-hidden /><span>{t(session ? 'staff.sess.note' : 'staff.sess.allNote', { name })}</span></p>
    </Dialog>
  );
}
