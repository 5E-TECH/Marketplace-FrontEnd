import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectAuthUser } from '../../model/authSlice';
import { useCurrentUserQuery } from '../../api/useCurrentUserQuery';
import { PageLoader } from '../../../../shared/ui/PageLoader/PageLoader';

export function SuperAdminOnlyRoute() {
  const storedRole = useAppSelector(selectAuthUser)?.role;
  const currentUserQuery = useCurrentUserQuery();
  if (currentUserQuery.isPending && !storedRole) return <PageLoader />;
  const role = currentUserQuery.data?.role ?? storedRole;
  return role === 'SUPERADMIN' ? <Outlet /> : <Navigate to="/admin/overview" replace />;
}
