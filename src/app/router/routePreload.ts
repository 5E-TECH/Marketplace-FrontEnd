export const routeImports = {
  home: () => import('../../pages/HomePage/HomePage'),
  products: () => import('../../pages/ProductsPage/ProductsPage'),
  productEditor: () => import('../../pages/ProductEditorPage/ProductEditorPage'),
  shop: () => import('../../pages/ShopPage/ShopPage'),
  profile: () => import('../../pages/ProfilePage/ProfilePage'),
  warehouses: () => import('../../pages/WarehousesPage/WarehousesPage'),
  stock: () => import('../../pages/StockPage/StockPage'),
  orders: () => import('../../pages/OrdersPage/OrdersPage'),
  delivery: () => import('../../pages/DeliveryPage/DeliveryPage'),
  settings: () => import('../../pages/SettingsPage/SettingsPage'),
  support: () => import('../../pages/SupportPage/SupportPage'),
  users: () => import('../../pages/UsersPage/UsersPage'),
  userEditor: () => import('../../pages/UserEditorPage/UserEditorPage'),
  adminShops: () => import('../../pages/AdminShopsPage/AdminShopsPage'),
  adminOrders: () => import('../../pages/AdminOrdersPage/AdminOrdersPage'),
  adminUsers: () => import('../../pages/AdminUsersPage/AdminUsersPage'),
  adminUserCreate: () => import('../../pages/AdminUserCreatePage/AdminUserCreatePage'),
  adminUserDetail: () => import('../../pages/AdminUserDetailPage/AdminUserDetailPage'),
  adminFinance: () => import('../../pages/AdminFinancePage/AdminFinancePage'),
  adminSystemHealth: () => import('../../pages/AdminSystemHealthPage/AdminSystemHealthPage'),
  checkout: () => import('../../pages/CheckoutPage/CheckoutPage'),
  adminOverview: () => import('../../pages/AdminOverviewPage/AdminOverviewPage'),
  adminResource: () => import('../../pages/AdminResourcePage/AdminResourcePage'),
  authRecovery: () => import('../../pages/AuthRecoveryPage/AuthRecoveryPage'),
};

export const routePreloaders: Array<[
  prefix: string,
  preload: () => Promise<unknown>,
]> = [
  ['/products/new', routeImports.productEditor],
  ['/products/', routeImports.productEditor],
  ['/products', routeImports.products],
  ['/shop', routeImports.shop],
  ['/warehouses', routeImports.warehouses],
  ['/stock', routeImports.stock],
  ['/orders', routeImports.orders],
  ['/delivery', routeImports.delivery],
  ['/profile', routeImports.profile],
  ['/settings', routeImports.settings],
  ['/support', routeImports.support],
  ['/users/new', routeImports.userEditor],
  ['/users', routeImports.users],
  ['/admin/shops', routeImports.adminShops],
  ['/admin/overview', routeImports.adminOverview],
  ['/admin/orders', routeImports.adminOrders],
  ['/admin/users/new', routeImports.adminUserCreate],
  ['/admin/users/', routeImports.adminUserDetail],
  ['/admin/users', routeImports.adminUsers],
  ['/admin/finance', routeImports.adminFinance],
  ['/admin/system-settings', routeImports.adminSystemHealth],
  ['/admin/', routeImports.adminResource],
  ['/checkout', routeImports.checkout],
  ['/', routeImports.home],
];

export function prefetchRoute(path: string): void {
  const route = routePreloaders.find(([prefix]) =>
    prefix === '/' ? path === '/' : path.startsWith(prefix),
  );
  if (route) void route[1]();
}
