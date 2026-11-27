import { useMutation } from '@tanstack/react-query';
import { App } from 'antd';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRoleHome } from '../../../app/router/routeAccess';
import { useAppDispatch } from '../../../app/store/hooks';
import { impersonationStarted } from '../../auth/model/authSlice';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { impersonateUser } from '../api/staffApi';
import styles from './staffUi.module.css';

/**
 * «Nomidan kirish» (faqat superadmin; backend — faqat sotuvchi va optovik): 15 daqiqalik token, kabinet shu
 * foydalanuvchi ko'rgandek ochiladi; muddat tugaganda yoki «Chiqish» bosilganda admin sahifasiga qaytadi.
 */
export function ImpersonateDialog({ userId, name, returnTo, onClose }: { userId: string; name: string; returnTo: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const impersonate = useMutation({ mutationFn: impersonateUser });

  const submit = () => {
    if (impersonate.isPending) return;
    impersonate.mutate(userId, {
      onSuccess: (grant) => {
        onClose();
        dispatch(impersonationStarted({ ...grant, returnTo }));
        void navigate(getRoleHome(grant.user.role), { replace: true });
      },
      onError: (error) => notification.error({ title: t('staff.imp.failed'), description: getApiErrorMessage(error), placement: 'bottomRight' }),
    });
  };

  return (
    <Dialog
      open
      title={t('staff.imp.title', { name })}
      description={t('staff.imp.sub')}
      icon={<LogIn />}
      width={440}
      locked={impersonate.isPending}
      onClose={onClose}
      testId="staff-impersonate-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={impersonate.isPending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={impersonate.isPending} savingLabel={t('staff.imp.saving')} shortcut={false} icon={<LogIn />}>{t('staff.imp.confirm')}</DialogPrimary>
        </>
      )}
    >
      <p className={styles.dialogText}>{t('staff.imp.text')}</p>
    </Dialog>
  );
}
