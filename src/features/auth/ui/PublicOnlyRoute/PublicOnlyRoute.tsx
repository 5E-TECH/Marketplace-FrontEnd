import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectIsAuthenticated } from '../../model/authSlice';

interface RedirectState {
  from?: {
    pathname?: unknown;
    search?: unknown;
    hash?: unknown;
  };
}

function getRedirectPath(state: unknown): string {
  const { from } = (state ?? {}) as RedirectState;

  if (
    !from ||
    typeof from.pathname !== 'string' ||
    !from.pathname.startsWith('/') ||
    from.pathname.startsWith('//')
  ) {
    return '/';
  }

  const search = typeof from.search === 'string' ? from.search : '';
  const hash = typeof from.hash === 'string' ? from.hash : '';

  return `${from.pathname}${search}${hash}`;
}

export function PublicOnlyRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();

  return isAuthenticated ? (
    <Navigate to={getRedirectPath(location.state)} replace />
  ) : (
    <Outlet />
  );
}
