import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { ProtectedRoute } from '../../features/auth/ui/ProtectedRoute/ProtectedRoute';
import { PublicOnlyRoute } from '../../features/auth/ui/PublicOnlyRoute/PublicOnlyRoute';
import { routeImports, routePreloaders } from './routePreload';

const MainLayout = lazy(() => import('../../layouts/MainLayout/MainLayout'));
const HomePage = lazy(routeImports.home);
const LoginPage = lazy(() => import('../../pages/LoginPage/LoginPage'));
const RegisterPage = lazy(() => import('../../pages/RegisterPage/RegisterPage'));
const NotFoundPage = lazy(() => import('../../pages/NotFoundPage/NotFoundPage'));
const ProductsPage = lazy(routeImports.products);
const ProductEditorPage = lazy(routeImports.productEditor);
const ShopPage = lazy(routeImports.shop);
const ProfilePage = lazy(routeImports.profile);
const WarehousesPage = lazy(routeImports.warehouses);
const StockPage = lazy(routeImports.stock);
const OrdersPage = lazy(routeImports.orders);
const DeliveryPage = lazy(routeImports.delivery);
const SettingsPage = lazy(routeImports.settings);
const SupportPage = lazy(routeImports.support);
const SharedUiTestPage = import.meta.env.DEV
  ? lazy(() => import('../../pages/__test__/SharedUiTestPage'))
  : null;

function useIdleRoutePrefetch(): void {
  useEffect(() => {
    const preload = () => {
      routePreloaders.slice(0, 7).forEach(([, load]) => void load());
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let idleId: number | undefined;
    const timerId = window.setTimeout(() => {
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(preload, { timeout: 2_500 });
      } else {
        preload();
      }
    }, 1_200);

    return () => {
      window.clearTimeout(timerId);
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
    };
  }, []);
}

export function AppRouter() {
  useIdleRoutePrefetch();

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {SharedUiTestPage ? (
            <Route path="__test__/shared-ui" element={<SharedUiTestPage />} />
          ) : null}
          <Route element={<PublicOnlyRoute />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/new" element={<ProductEditorPage />} />
              <Route path="products/:productId/edit" element={<ProductEditorPage />} />
              <Route path="warehouses" element={<WarehousesPage />} />
              <Route path="stock" element={<StockPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="delivery" element={<DeliveryPage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="support" element={<SupportPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
