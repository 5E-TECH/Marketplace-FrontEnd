import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectAuthUser } from '../../model/authSlice';

export function SellerOnlyRoute() {
  const user = useAppSelector(selectAuthUser);
  return user?.role === 'SELLER' ? <Outlet /> : <Navigate to="/" replace />;
}
