import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { ProtectedRoute } from '../../features/auth/ui/ProtectedRoute/ProtectedRoute';
import { PublicOnlyRoute } from '../../features/auth/ui/PublicOnlyRoute/PublicOnlyRoute';
import { SeoManager } from '../../shared/seo/SeoManager';
import { useAppSelector } from '../store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { appRoutes, documentRoutes } from './routeManifest';
import { getRoleHome } from './routeAccess';
import { RequireRole } from './RequireRole';

const AppShell = lazy(() => import('../../layouts/AppShell/AppShell'));
const LoginPage = lazy(() => import('../../pages/LoginPage/LoginPage'));
const RegisterPage = lazy(() => import('../../pages/RegisterPage/RegisterPage'));
const NotFoundPage = lazy(() => import('../../pages/NotFoundPage/NotFoundPage'));
const SharedUiTestPage = import.meta.env.DEV
  ? lazy(() => import('../../pages/__test__/SharedUiTestPage'))
  : null;

// Har sahifa uchun bitta lazy komponent: preload (`prefetchRoute`) bilan bir xil import.
const pages = new Map([...appRoutes, ...documentRoutes].map((route) => [route.path, lazy(route.load)]));

/** `/` — rolning o'z bosh sahifasi. */
function RoleHomeRedirect() {
  const role = useAppSelector(selectAuthUser)?.role;
  return <Navigate to={role ? getRoleHome(role) : '/login'} replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <SeoManager />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {SharedUiTestPage ? (
            <Route path="__test__/shared-ui" element={<SharedUiTestPage />} />
          ) : null}
          <Route element={<PublicOnlyRoute />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          {/* Kirmagan foydalanuvchi har qanday manzildan login'ga; kirgani — panel ichida 404. */}
          <Route element={<ProtectedRoute />}>
            {documentRoutes.map((route) => {
              const Page = pages.get(route.path);
              return Page ? <Route key={route.path} path={route.path} element={<RequireRole route={route}><Page /></RequireRole>} /> : null;
            })}
            <Route element={<AppShell />}>
              <Route index element={<RoleHomeRedirect />} />
              {appRoutes.map((route) => {
                const Page = pages.get(route.path);
                return Page ? (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={<RequireRole route={route}><Page /></RequireRole>}
                  />
                ) : null;
              })}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
