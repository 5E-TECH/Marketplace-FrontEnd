import { Banknote, Boxes, ChartNoAxesCombined, ClipboardList, Megaphone, MessageSquareText, PackageSearch, Settings, Store, Users } from 'lucide-react';
import type { ReactNode } from 'react';

export interface AdminNavItem { path: string; label: string; icon?: ReactNode }
export interface AdminNavGroup { key: string; label: string; icon: ReactNode; items: AdminNavItem[] }

export const adminNavigation: AdminNavGroup[] = [
  { key: 'overview', label: 'Dashboard', icon: <ChartNoAxesCombined />, items: [{ path: '/admin/overview', label: 'Analytics & metrics' }] },
  { key: 'sellers', label: 'Sotuvchilar va do‘konlar', icon: <Store />, items: [{ path: '/admin/sellers', label: 'Sotuvchilar' }, { path: '/admin/shops', label: 'KYC so‘rovlari' }, { path: '/admin/payout-history', label: 'Komissiya tarixi' }] },
  { key: 'catalog', label: 'Mahsulotlar va katalog', icon: <PackageSearch />, items: [{ path: '/admin/products', label: 'Mahsulot moderatsiyasi' }, { path: '/admin/categories', label: 'Kategoriyalar' }, { path: '/admin/brands', label: 'Brendlar' }, { path: '/admin/attributes', label: 'Atributlar' }] },
  { key: 'orders', label: 'Buyurtmalar', icon: <ClipboardList />, items: [{ path: '/admin/orders', label: 'Global buyurtmalar' }, { path: '/admin/transactions', label: 'Tranzaksiyalar' }] },
  { key: 'inventory', label: 'Ombor va qoldiqlar', icon: <Boxes />, items: [{ path: '/admin/warehouses', label: 'Omborlar' }, { path: '/admin/stock', label: 'Qoldiq monitoringi' }, { path: '/admin/transfers', label: 'Transfer so‘rovlari' }] },
  { key: 'users', label: 'Foydalanuvchilar', icon: <Users />, items: [{ path: '/admin/users', label: 'Barcha foydalanuvchilar' }] },
  { key: 'marketing', label: 'Marketing', icon: <Megaphone />, items: [{ path: '/admin/banners', label: 'Bannerlar' }, { path: '/admin/promocodes', label: 'Promokodlar' }, { path: '/admin/collections', label: 'Flash sale va kolleksiya' }] },
  { key: 'finance', label: 'Moliya', icon: <Banknote />, items: [{ path: '/admin/finance', label: 'Payout va hisobotlar' }] },
  { key: 'moderation', label: 'Sharhlar', icon: <MessageSquareText />, items: [{ path: '/admin/reviews', label: 'Sharh moderatsiyasi' }, { path: '/admin/disputes', label: 'Reyting va shikoyatlar' }] },
  { key: 'settings', label: 'Tizim', icon: <Settings />, items: [{ path: '/admin/system-settings', label: 'Tizim holati' }, { path: '/admin/audit-logs', label: 'Audit loglar' }] },
];

export const adminLeafRoutes = adminNavigation.flatMap(({ items }) => items);
export const adminRouteTitle = (pathname: string) => adminLeafRoutes.find(({ path }) => pathname === path)?.label ?? 'Admin boshqaruvi';
