import {
  AppstoreOutlined,
  BarChartOutlined,
  CustomerServiceOutlined,
  HomeOutlined,
  ProfileOutlined,
  SettingOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

export interface AppRouteMeta {
  path: string;
  label: string;
  icon: ReactNode;
  section: 'main' | 'utility';
}

export const appRouteConfig: AppRouteMeta[] = [
  { path: '/', label: 'Bosh sahifa', icon: <BarChartOutlined />, section: 'main' },
  { path: '/shop', label: 'Do‘kon profili', icon: <ShopOutlined />, section: 'main' },
  { path: '/products', label: 'Mahsulotlar', icon: <AppstoreOutlined />, section: 'main' },
  { path: '/warehouses', label: 'Sklad', icon: <HomeOutlined />, section: 'main' },
  { path: '/orders', label: 'Buyurtmalar', icon: <ProfileOutlined />, section: 'main' },
  { path: '/settings', label: 'Sozlamalar', icon: <SettingOutlined />, section: 'utility' },
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
