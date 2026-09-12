import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectIsAuthenticated } from '../../model/authSlice';
import { useCurrentUserQuery } from '../../api/useCurrentUserQuery';
import { PageLoader } from '../../../../shared/ui/PageLoader/PageLoader';
import { ContentState } from '../../../../shared/ui/ContentState/ContentState';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { canAccessCabinet } from '../../lib/sellerAccess';
import { useLogoutMutation } from '../../api/useLogoutMutation';

export function ProtectedRoute() {
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (currentUserQuery.isPending) {
    return <PageLoader />;
  }

  if (currentUserQuery.isError) {
    return (
      <ContentState
        state="error"
        description={t('auth.profileLoadError')}
        onAction={() => void currentUserQuery.refetch()}
      />
    );
  }

  if (!canAccessCabinet(currentUserQuery.data)) {
    return (
      <ContentState
        state="forbidden"
        title={t('auth.sellerRequired')}
        description={t('auth.roleDenied', { role: currentUserQuery.data.role })}
        actionLabel={t('auth.loginAsSeller')}
        onAction={() => logoutMutation.mutate()}
      />
    );
  }

  return <Outlet />;
}
