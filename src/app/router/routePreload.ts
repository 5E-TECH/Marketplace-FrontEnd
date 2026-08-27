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
  ['/', routeImports.home],
];

export function prefetchRoute(path: string): void {
  const route = routePreloaders.find(([prefix]) =>
    prefix === '/' ? path === '/' : path.startsWith(prefix),
  );
  if (route) void route[1]();
}
