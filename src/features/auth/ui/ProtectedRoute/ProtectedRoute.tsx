import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectIsAuthenticated } from '../../model/authSlice';
import { useCurrentUserQuery } from '../../api/useCurrentUserQuery';
import { PageLoader } from '../../../../shared/ui/PageLoader/PageLoader';
import { ContentState } from '../../../../shared/ui/ContentState/ContentState';
import { isAuthPreviewEnabled } from '../../lib/authPreview';

export function ProtectedRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();
  const currentUserQuery = useCurrentUserQuery();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isAuthPreviewEnabled) {
    return <Outlet />;
  }

  if (currentUserQuery.isPending) {
    return <PageLoader />;
  }

  if (currentUserQuery.isError) {
    return (
      <ContentState
        state="error"
        description="Profil ma’lumotini olib bo‘lmadi. Qayta urinib ko‘ring."
        onAction={() => void currentUserQuery.refetch()}
      />
    );
  }

  return <Outlet />;
}
