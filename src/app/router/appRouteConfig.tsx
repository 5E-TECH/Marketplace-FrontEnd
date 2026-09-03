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
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { UserRole } from '../../features/auth/model/authTypes';

/** Faqat sotuvchi ko'radigan bo'limlar (backend'da ham @Roles(SELLER)). */
const SELLER_ONLY: readonly UserRole[] = ['SELLER'];
/** Operator ham ishlaydigan bo'limlar (backend'da @Roles(SELLER, OPERATOR)). */
const SELLER_AND_OPERATOR: readonly UserRole[] = ['SELLER', 'OPERATOR'];

export interface AppRouteMeta {
  path: string;
  label: string;
  icon: ReactNode;
  section: 'main' | 'utility';
  showInSidebar?: boolean;
  /** Backend'dagi @Roles bilan mos rollar ro'yxati. */
  roles: readonly UserRole[];
}

export const appRouteConfig: AppRouteMeta[] = [
  { path: '/', label: 'Bosh sahifa', icon: <BarChartOutlined />, section: 'main', roles: SELLER_ONLY },
  { path: '/shop', label: 'Do‘kon profili', icon: <ShopOutlined />, section: 'main', roles: SELLER_ONLY },
  { path: '/profile', label: 'Mening profilim', icon: <ShopOutlined />, section: 'main', showInSidebar: false, roles: SELLER_ONLY },
  { path: '/products', label: 'Mahsulotlar', icon: <AppstoreOutlined />, section: 'main', roles: SELLER_ONLY },
  { path: '/warehouses', label: 'Omborlar', icon: <HomeOutlined />, section: 'main', roles: SELLER_ONLY },
  { path: '/stock', label: 'Qoldiq', icon: <Boxes />, section: 'main', roles: SELLER_ONLY },
  { path: '/orders', label: 'Buyurtmalar', icon: <ProfileOutlined />, section: 'main', roles: SELLER_AND_OPERATOR },
  { path: '/delivery', label: 'Yetkazib berish', icon: <TruckOutlined />, section: 'main', roles: SELLER_AND_OPERATOR },
  { path: '/settings', label: 'Sozlamalar', icon: <SettingOutlined />, section: 'utility', showInSidebar: false, roles: SELLER_AND_OPERATOR },
  { path: '/support', label: 'Yordam', icon: <CustomerServiceOutlined />, section: 'utility', roles: SELLER_AND_OPERATOR },
];

export function findRouteMeta(pathname: string): AppRouteMeta | undefined {
  return [...appRouteConfig]
    .sort((first, second) => second.path.length - first.path.length)
    .find(({ path }) =>
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
