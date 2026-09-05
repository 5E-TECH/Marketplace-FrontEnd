import {
  Truck as TruckOutlined,
  ChartNoAxesCombined as BarChartOutlined,
  Package as AppstoreOutlined,
  ClipboardList as ProfileOutlined,
  Headphones as CustomerServiceOutlined,
  Warehouse as HomeOutlined,
  Boxes,
  Settings as SettingOutlined,
  Store as ShopOutlined,
  UserRoundCog,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { TranslationKey } from '../../shared/i18n/translations';
import type { UserRole } from '../../features/auth/model/authTypes';

/** Faqat sotuvchi ko'radigan bo'limlar (backend'da ham @Roles(SELLER)). */
const SELLER_ONLY: readonly UserRole[] = ['SELLER'];
/** Operator ham ishlaydigan bo'limlar (backend'da @Roles(SELLER, OPERATOR)). */
const SELLER_AND_OPERATOR: readonly UserRole[] = ['SELLER', 'OPERATOR'];
const ADMIN_ONLY: readonly UserRole[] = ['ADMIN', 'SUPERADMIN'];
const BUYER_ONLY: readonly UserRole[] = ['BUYER'];

export interface AppRouteMeta {
  path: string;
  label: TranslationKey;
  icon: ReactNode;
  section: 'main' | 'utility';
  showInSidebar?: boolean;
  /** Backend'dagi @Roles bilan mos rollar ro'yxati. */
  roles: readonly UserRole[];
}

export const appRouteConfig: AppRouteMeta[] = [
  { path: '/', label: 'nav.home', icon: <BarChartOutlined />, section: 'main', roles: SELLER_ONLY },
  { path: '/admin/shops', label: 'nav.adminShops', icon: <ShieldCheck />, section: 'main', roles: ADMIN_ONLY },
  { path: '/admin/orders', label: 'nav.adminOrders', icon: <ProfileOutlined />, section: 'main', roles: ADMIN_ONLY },
  { path: '/checkout', label: 'nav.checkout', icon: <ShoppingCart />, section: 'main', roles: BUYER_ONLY },
  { path: '/users', label: 'nav.users', icon: <UserRoundCog />, section: 'main', roles: SELLER_ONLY },
  { path: '/shop', label: 'nav.shop', icon: <ShopOutlined />, section: 'main', roles: SELLER_ONLY },
  { path: '/products', label: 'nav.products', icon: <AppstoreOutlined />, section: 'main', roles: SELLER_ONLY },
  { path: '/warehouses', label: 'nav.warehouses', icon: <HomeOutlined />, section: 'main', roles: SELLER_ONLY },
  { path: '/stock', label: 'nav.stock', icon: <Boxes />, section: 'main', roles: SELLER_ONLY },
  { path: '/orders', label: 'nav.orders', icon: <ProfileOutlined />, section: 'main', roles: SELLER_AND_OPERATOR },
  { path: '/delivery', label: 'nav.delivery', icon: <TruckOutlined />, section: 'main', roles: SELLER_AND_OPERATOR },
  { path: '/profile', label: 'nav.profile', icon: <ShopOutlined />, section: 'main', showInSidebar: false, roles: SELLER_AND_OPERATOR },
  { path: '/settings', label: 'nav.settings', icon: <SettingOutlined />, section: 'utility', showInSidebar: false, roles: SELLER_AND_OPERATOR },
  { path: '/support', label: 'nav.support', icon: <CustomerServiceOutlined />, section: 'utility', roles: SELLER_AND_OPERATOR },
];

const routesBySpecificity = [...appRouteConfig].sort(
  (first, second) => second.path.length - first.path.length,
);

export function findRouteMeta(pathname: string): AppRouteMeta | undefined {
  return routesBySpecificity.find(({ path }) =>
      path === '/'
        ? pathname === '/'
        : pathname === path || pathname.startsWith(`${path}/`),
    );
}

/**
 * Berilgan yo'l shu rol uchun ochiqmi. Konfiguratsiyada yo'q yo'llar
 * (masalan `/products/new`) eng yaqin ota-yo'l qoidasiga bo'ysunadi.
 */
export function canAccessRoute(pathname: string, role: UserRole): boolean {
  const route = findRouteMeta(pathname);
  return route ? route.roles.includes(role) : true;
}

/** Rol uchun ochiq bo'lgan birinchi bo'lim — login/redirect uchun. */
export function getDefaultRoute(role: UserRole): string {
  return appRouteConfig.find((route) => route.roles.includes(role))?.path ?? '/';
}
