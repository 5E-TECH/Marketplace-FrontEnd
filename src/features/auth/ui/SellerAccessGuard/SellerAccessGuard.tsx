import { App } from 'antd';
import { Outlet } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  canAccessRoute,
  getDefaultRoute,
} from '../../../../app/router/appRouteConfig';
import { useAppSelector } from '../../../../app/store/hooks';
import { ContentState } from '../../../../shared/ui/ContentState/ContentState';
import { selectAuthUser } from '../../model/authSlice';
import { canAccessSellerCabinet } from '../../lib/sellerAccess';
import { useLogoutMutation } from '../../api/useLogoutMutation';
import { useTranslation } from '../../../../shared/i18n/useTranslation';

export function SellerAccessGuard({ children }: { children?: React.ReactNode }) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);
  const logoutMutation = useLogoutMutation();

  const switchToSeller = () => {
    logoutMutation.mutate(undefined, {
      onError: () =>
        void message.warning(
          t('auth.localSessionCleared'),
        ),
    });
  };

  if (!user) {
    return (
      <ContentState
        state="error"
        title={t('auth.profileMissing')}
        description={t('auth.refreshOrLogin')}
      />
    );
  }

  if (!canAccessSellerCabinet(user)) {
    return (
      <ContentState
        state="forbidden"
        title={t('auth.sellerRequired')}
        description={t('auth.roleDenied', { role: user.role })}
        actionLabel={t('auth.loginAsSeller')}
        onAction={switchToSeller}
      />
    );
  }

  if (!canAccessRoute(location.pathname, user.role)) {
    const fallback = getDefaultRoute(user.role);

    return (
      <ContentState
        state="forbidden"
        title={t('auth.sectionDenied')}
        description={t('auth.sectionDeniedDescription', { role: user.role })}
        actionLabel={t('auth.goToAllowed')}
        onAction={() => void navigate(fallback, { replace: true })}
      />
    );
  }

  return children ?? <Outlet />;
}
