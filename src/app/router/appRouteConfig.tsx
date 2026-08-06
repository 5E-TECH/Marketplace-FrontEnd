import {
  ChartNoAxesCombined as BarChartOutlined,
  Package as AppstoreOutlined,
  ClipboardList as ProfileOutlined,
  Headphones as CustomerServiceOutlined,
  Warehouse as HomeOutlined,
  Settings as SettingOutlined,
  Store as ShopOutlined,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface AppRouteMeta {
  path: string;
  label: string;
  icon: ReactNode;
  section: 'main' | 'utility';
  showInSidebar?: boolean;
}

export const appRouteConfig: AppRouteMeta[] = [
  { path: '/', label: 'Bosh sahifa', icon: <BarChartOutlined />, section: 'main' },
  { path: '/shop', label: 'Do‘kon profili', icon: <ShopOutlined />, section: 'main' },
  { path: '/profile', label: 'Do‘kon profili', icon: <ShopOutlined />, section: 'main', showInSidebar: false },
  { path: '/products', label: 'Mahsulotlar', icon: <AppstoreOutlined />, section: 'main' },
  { path: '/warehouses', label: 'Sklad', icon: <HomeOutlined />, section: 'main' },
  { path: '/orders', label: 'Buyurtmalar', icon: <ProfileOutlined />, section: 'main' },
  { path: '/settings', label: 'Sozlamalar', icon: <SettingOutlined />, section: 'utility', showInSidebar: false },
  { path: '/support', label: 'Yordam', icon: <CustomerServiceOutlined />, section: 'utility' },
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
