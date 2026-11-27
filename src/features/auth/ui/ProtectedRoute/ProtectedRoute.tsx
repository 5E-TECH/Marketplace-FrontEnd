import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectAccountLock, selectAuthUser, selectImpersonationEnd, selectIsAuthenticated, selectManualLogout, selectRoleChange, selectSessionExpired } from '../../model/authSlice';
import { useCurrentUserQuery } from '../../api/useCurrentUserQuery';
import { PageLoader } from '../../../../shared/ui/PageLoader/PageLoader';
import { ContentState } from '../../../../shared/ui/ContentState/ContentState';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { ACCOUNT_BLOCKED_PATH } from '../../lib/accountLock';
import { canAccessCabinet } from '../../lib/cabinetAccess';
import { UnknownRoleError } from '../../lib/unknownRoleError';
import { useLogoutMutation } from '../../api/useLogoutMutation';
import { ImpersonationBanner } from '../ImpersonationBanner/ImpersonationBanner';
import { RoleChangedScreen } from '../RoleChanged/RoleChangedScreen';

export function ProtectedRoute() {
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const impersonationEnd = useAppSelector(selectImpersonationEnd);
  const manualLogout = useAppSelector(selectManualLogout);
  // Sessiya tugagan: sahifa joyida, ustida qayta kirish oynasi (AppShell) — login'ga otilmaydi.
  const sessionExpired = useAppSelector(selectSessionExpired);
  // Hisob yopildi (FE-15): sahifa ochiq bo'lsa — ustida oyna (AppShell), profil hali yo'q bo'lsa — karkassiz sahifa.
  const accountLock = useAppSelector(selectAccountLock);
  const roleChange = useAppSelector(selectRoleChange);
  const user = useAppSelector(selectAuthUser);
  const location = useLocation();
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  if (accountLock && !user) return <Navigate to={ACCOUNT_BLOCKED_PATH} replace />;

  if (!isAuthenticated && !sessionExpired && !accountLock) {
    // Qo'lda chiqishda qaytish manzili saqlanmaydi (keyingi kirgan boshqa odam bo'lishi mumkin).
    return <Navigate to="/login" replace state={manualLogout ? null : { from: location }} />;
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

  // O'sha odam qayta kirdi, roli boshqa (umumiy-sessiya 9): eski rol sahifasi o'rniga karkassiz «Rolingiz o‘zgardi».
  if (roleChange && user?.role === roleChange.after) return <RoleChangedScreen user={user} before={roleChange.before} />;

  return <>{banner}<Outlet /></>;
}
