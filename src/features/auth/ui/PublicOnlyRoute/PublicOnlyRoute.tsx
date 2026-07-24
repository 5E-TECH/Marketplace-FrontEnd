import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectIsAuthenticated } from '../../model/authSlice';

export function PublicOnlyRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
}
