import {
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
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { TranslationKey } from '../../shared/i18n/translations';

export interface AppRouteMeta {
  path: string;
  label: TranslationKey;
  icon: ReactNode;
  section: 'main' | 'utility';
  showInSidebar?: boolean;
  roles?: Array<'SELLER' | 'OPERATOR' | 'BUYER' | 'ADMIN' | 'SUPERADMIN'>;
}

export const appRouteConfig: AppRouteMeta[] = [
  { path: '/', label: 'nav.home', icon: <BarChartOutlined />, section: 'main' },
  { path: '/admin/shops', label: 'nav.adminShops', icon: <ShieldCheck />, section: 'main', roles: ['ADMIN', 'SUPERADMIN'] },
  { path: '/admin/orders', label: 'nav.adminOrders', icon: <ProfileOutlined />, section: 'main', roles: ['ADMIN', 'SUPERADMIN'] },
  { path: '/users', label: 'nav.users', icon: <UserRoundCog />, section: 'main' },
  { path: '/shop', label: 'nav.shop', icon: <ShopOutlined />, section: 'main' },
  { path: '/products', label: 'nav.products', icon: <AppstoreOutlined />, section: 'main' },
  { path: '/warehouses', label: 'nav.warehouses', icon: <HomeOutlined />, section: 'main' },
  { path: '/stock', label: 'nav.stock', icon: <Boxes />, section: 'main' },
  { path: '/orders', label: 'nav.orders', icon: <ProfileOutlined />, section: 'main' },
  { path: '/delivery', label: 'nav.delivery', icon: <ProfileOutlined />, section: 'main', showInSidebar: false },
  { path: '/profile', label: 'nav.profile', icon: <ShopOutlined />, section: 'main', showInSidebar: false },
  { path: '/settings', label: 'nav.settings', icon: <SettingOutlined />, section: 'utility', showInSidebar: false },
  { path: '/support', label: 'nav.support', icon: <CustomerServiceOutlined />, section: 'utility' },
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
