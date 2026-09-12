import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { ProtectedRoute } from '../../features/auth/ui/ProtectedRoute/ProtectedRoute';
import { PublicOnlyRoute } from '../../features/auth/ui/PublicOnlyRoute/PublicOnlyRoute';
import { routeImports } from './routePreload';
import { SeoManager } from '../../shared/seo/SeoManager';
import { SellerAccessGuard } from '../../features/auth/ui/SellerAccessGuard/SellerAccessGuard';
import { SellerOnlyRoute } from '../../features/auth/ui/SellerOnlyRoute/SellerOnlyRoute';
import { AdminOnlyRoute } from '../../features/auth/ui/AdminOnlyRoute/AdminOnlyRoute';
import { SuperAdminOnlyRoute } from '../../features/auth/ui/SuperAdminOnlyRoute/SuperAdminOnlyRoute';
import { useAppSelector } from '../store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';

const MainLayout = lazy(() => import('../../layouts/MainLayout/MainLayout'));
const AdminLayout = lazy(() => import('../../layouts/AdminLayout/AdminLayout'));
const HomePage = lazy(routeImports.home);
const LoginPage = lazy(() => import('../../pages/LoginPage/LoginPage'));
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
const AdminShopsPage = lazy(routeImports.adminShops);
const AdminOrdersPage = lazy(routeImports.adminOrders);
const AdminProductsPage = lazy(routeImports.adminProducts);
const AdminProductDetailPage = lazy(routeImports.adminProductDetail);
const AdminUsersPage = lazy(routeImports.adminUsers);
const AdminUserCreatePage = lazy(routeImports.adminUserCreate);
const AdminUserDetailPage = lazy(routeImports.adminUserDetail);
const AdminFinancePage = lazy(routeImports.adminFinance);
const AdminSystemHealthPage = lazy(routeImports.adminSystemHealth);
const AdminOverviewPage = lazy(routeImports.adminOverview);
const AdminResourcePage = lazy(routeImports.adminResource);
const AdminCategoriesPage = lazy(() => import('../../pages/AdminCategoriesPage/AdminCategoriesPage'));
const SharedUiTestPage = import.meta.env.DEV
  ? lazy(() => import('../../pages/__test__/SharedUiTestPage'))
  : null;

function RoleHomeRoute() {
  const role = useAppSelector(selectAuthUser)?.role;
  if (role === 'ADMIN' || role === 'SUPERADMIN') return <Navigate to="/admin/overview" replace />;
  return <SellerAccessGuard><HomePage /></SellerAccessGuard>;
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
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AdminOnlyRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="admin/overview" element={<AdminOverviewPage />} />
                <Route path="admin/shops" element={<AdminShopsPage />} />
                <Route path="admin/orders" element={<AdminOrdersPage />} />
                <Route path="admin/products" element={<AdminProductsPage />} />
                <Route path="admin/products/:productId" element={<AdminProductDetailPage />} />
                <Route path="admin/users" element={<AdminUsersPage />} />
                <Route path="admin/users/new" element={<AdminUserCreatePage />} />
                <Route path="admin/users/:userId" element={<AdminUserDetailPage />} />
                <Route element={<SuperAdminOnlyRoute />}>
                  <Route path="admin/finance" element={<AdminFinancePage />} />
                  <Route path="admin/team" element={<AdminResourcePage />} />
                </Route>
                <Route path="admin/system-settings" element={<AdminSystemHealthPage />} />
                <Route path="admin/categories" element={<AdminCategoriesPage />} />
                <Route path="admin/profile" element={<ProfilePage />} />
                <Route path="admin/:module" element={<AdminResourcePage />} />
              </Route>
            </Route>
            <Route element={<MainLayout />}>
              <Route index element={<RoleHomeRoute />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route element={<SellerAccessGuard />}>
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
