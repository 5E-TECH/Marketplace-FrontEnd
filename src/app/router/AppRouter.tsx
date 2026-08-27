import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { ProtectedRoute } from '../../features/auth/ui/ProtectedRoute/ProtectedRoute';
import { PublicOnlyRoute } from '../../features/auth/ui/PublicOnlyRoute/PublicOnlyRoute';
import { routeImports } from './routePreload';
import { SeoManager } from '../../shared/seo/SeoManager';
import { SellerAccessGuard } from '../../features/auth/ui/SellerAccessGuard/SellerAccessGuard';
import { SellerOnlyRoute } from '../../features/auth/ui/SellerOnlyRoute/SellerOnlyRoute';

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
const UsersPage = lazy(routeImports.users);
const UserEditorPage = lazy(routeImports.userEditor);
const SharedUiTestPage = import.meta.env.DEV
  ? lazy(() => import('../../pages/__test__/SharedUiTestPage'))
  : null;

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

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route element={<SellerAccessGuard />}>
                <Route index element={<HomePage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="products/new" element={<ProductEditorPage />} />
                <Route path="products/:productId/edit" element={<ProductEditorPage />} />
                <Route path="warehouses" element={<WarehousesPage />} />
                <Route path="stock" element={<StockPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="delivery" element={<DeliveryPage />} />
                <Route element={<SellerOnlyRoute />}>
                  <Route path="users" element={<UsersPage />} />
                  <Route path="users/new" element={<UserEditorPage />} />
                </Route>
                <Route path="shop" element={<ShopPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
