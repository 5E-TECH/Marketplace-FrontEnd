import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectImpersonationEnd, selectIsAuthenticated } from '../../model/authSlice';
import { useCurrentUserQuery } from '../../api/useCurrentUserQuery';
import { PageLoader } from '../../../../shared/ui/PageLoader/PageLoader';
import { ContentState } from '../../../../shared/ui/ContentState/ContentState';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { canAccessCabinet } from '../../lib/cabinetAccess';
import { UnknownRoleError } from '../../lib/unknownRoleError';
import { useLogoutMutation } from '../../api/useLogoutMutation';
import { ImpersonationBanner } from '../ImpersonationBanner/ImpersonationBanner';

export function ProtectedRoute() {
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const impersonationEnd = useAppSelector(selectImpersonationEnd);
  const location = useLocation();
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // "Nomidan kirish" chizig'i har holatda ko'rinadi — profil yuklanmasa ham chiqib ketish mumkin.
  const banner = <ImpersonationBanner />;

  // Shaxs almashayotganda (nomidan kirish tugadi) sahifa chizilmaydi: aks holda eski
  // sahifaning o'z yo'naltirishi (masalan `/` → `/admin/overview`) qaytish sahifasini bosib ketardi.
  if (impersonationEnd || currentUserQuery.isPending) {
    return <>{banner}<PageLoader /></>;
  }

  // Backend bilmagan rol (masalan, eski SELLER): karkas o'zi menyusiz «Noma’lum rol»
  // holatini, sabab va chiqish yo'lini ko'rsatadi (umumiy-403, FE-01 TC3).
  if (currentUserQuery.error instanceof UnknownRoleError) {
    return <>{banner}<Outlet /></>;
  }

  if (currentUserQuery.isError) {
    return <>{banner}
      <ContentState
        state="error"
        description={t('auth.profileLoadError')}
        onAction={() => void currentUserQuery.refetch()}
      />
    </>;
  }

  if (!canAccessCabinet(currentUserQuery.data)) {
    return <>{banner}
      <ContentState
        state="forbidden"
        title={t('auth.accountUnavailableTitle')}
        description={t('auth.accountUnavailableDescription')}
        actionLabel={t('auth.switchAccount')}
        onAction={() => logoutMutation.mutate()}
      />
    </>;
  }

  return <>{banner}<Outlet /></>;
}
