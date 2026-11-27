import { App, Button } from 'antd';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { useUnblockUserMutation } from '../api/staffQueries';
import { displayName } from '../lib/staffFormat';
import type { UserAccount } from '../model/staffTypes';

/**
 * «Blokdan chiqarish» (admin-foydalanuvchilar, karta K3): tasdiqsiz; xodim toastida — «Parolni tiklash» (eski parol
 * bilan kiradi, kerak bo'lsa tiklanadi). Sotuvchi parolsiz — telefon va SMS kod bilan kiradi.
 */
export function useUnblockUser(onResetPassword?: (user: UserAccount) => void) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const unblock = useUnblockUserMutation();
  const placement = phone ? 'top' : 'bottomRight';

  const run = (user: UserAccount) => {
    const name = displayName(user);
    unblock.mutate(user.id, {
      onSuccess: () => {
        const key = `unblock-${user.id}`;
        const seller = user.role === 'AFFILIATE';
        notification.success({
          key,
          title: t('staff.toast.unblocked', { name }),
          description: t(seller ? 'staff.toast.unblockedSellerText' : 'staff.toast.unblockedText'),
          placement,
          duration: 6,
          actions: onResetPassword && !seller
            ? <Button size="small" onClick={() => { notification.destroy(key); onResetPassword(user); }}>{t('staff.toast.resetPassword')}</Button>
            : undefined,
        });
      },
      onError: (error) => notification.error({ title: t('staff.toast.unblockFailed'), description: getApiErrorMessage(error), placement }),
    });
  };
  return { run, pending: unblock.isPending };
}
