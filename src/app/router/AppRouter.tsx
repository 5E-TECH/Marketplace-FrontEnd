import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { ProtectedRoute } from '../../features/auth/ui/ProtectedRoute/ProtectedRoute';
import { PublicOnlyRoute } from '../../features/auth/ui/PublicOnlyRoute/PublicOnlyRoute';

const MainLayout = lazy(() => import('../../layouts/MainLayout/MainLayout'));
const HomePage = lazy(() => import('../../pages/HomePage/HomePage'));
const LoginPage = lazy(() => import('../../pages/LoginPage/LoginPage'));
const NotFoundPage = lazy(() => import('../../pages/NotFoundPage/NotFoundPage'));
const ProductsPage = lazy(() => import('../../pages/ProductsPage/ProductsPage'));
const ShopPage = lazy(() => import('../../pages/ShopPage/ShopPage'));
const WarehousesPage = lazy(
  () => import('../../pages/WarehousesPage/WarehousesPage'),
);
const OrdersPage = lazy(() => import('../../pages/OrdersPage/OrdersPage'));
const DeliveryPage = lazy(() => import('../../pages/DeliveryPage/DeliveryPage'));
const SettingsPage = lazy(() => import('../../pages/SettingsPage/SettingsPage'));
const SupportPage = lazy(() => import('../../pages/SupportPage/SupportPage'));

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="login" element={<LoginPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="warehouses" element={<WarehousesPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="delivery" element={<DeliveryPage />} />
              <Route path="shop" element={<ShopPage />} />
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
