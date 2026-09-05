import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getDefaultRoute } from '../../../../app/router/appRouteConfig';
import { useAppSelector } from '../../../../app/store/hooks';
import { selectAuthUser, selectIsAuthenticated } from '../../model/authSlice';

interface RedirectState {
  from?: {
    pathname?: unknown;
    search?: unknown;
    hash?: unknown;
  };
}

function getRedirectPath(state: unknown, fallback: string): string {
  const { from } = (state ?? {}) as RedirectState;

  if (
    !from ||
    typeof from.pathname !== 'string' ||
    !from.pathname.startsWith('/') ||
    from.pathname.startsWith('//')
  ) {
    return fallback;
  }

  const search = typeof from.search === 'string' ? from.search : '';
  const hash = typeof from.hash === 'string' ? from.hash : '';

  return `${from.pathname}${search}${hash}`;
}

export function PublicOnlyRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectAuthUser);
  const location = useLocation();
  // Operatorda bosh sahifa (sotuvchi dashboardi) yopiq — uni o'ziga
  // ochiq birinchi bo'limga yuboramiz.
  const fallback = user ? getDefaultRoute(user.role) : '/';

  return isAuthenticated ? (
    <Navigate to={getRedirectPath(location.state, fallback)} replace />
  ) : (
    <Outlet />
  );
}
