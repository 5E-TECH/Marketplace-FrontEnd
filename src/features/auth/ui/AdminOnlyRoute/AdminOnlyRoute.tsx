import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectAuthUser } from '../../model/authSlice';

export function AdminOnlyRoute() {
  const role = useAppSelector(selectAuthUser)?.role;
  return role === 'ADMIN' || role === 'SUPERADMIN' ? <Outlet /> : <Navigate to="/" replace />;
}
