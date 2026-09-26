import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectAuthUser } from '../../model/authSlice';
import { useCurrentUserQuery } from '../../api/useCurrentUserQuery';
import { PageLoader } from '../../../../shared/ui/PageLoader/PageLoader';
import { getDefaultRoute } from '../../../../app/router/appRouteConfig';

export function AdminOnlyRoute() {
  const storedRole = useAppSelector(selectAuthUser)?.role;
  const currentUserQuery = useCurrentUserQuery();
  if (currentUserQuery.isPending && !storedRole) return <PageLoader />;
  const role = currentUserQuery.data?.role ?? storedRole;
  if (role === 'ADMIN' || role === 'SUPERADMIN') return <Outlet />;
  // `/` faqat SELLER uchun — OPERATOR u yerda "ruxsat yo'q" ekraniga tushib qolardi.
  return <Navigate to={role ? getDefaultRoute(role) : '/'} replace />;
}
