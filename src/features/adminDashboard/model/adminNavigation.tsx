import { Banknote, Boxes, ChartNoAxesCombined, ClipboardList, Megaphone, MessageSquareText, PackageSearch, Settings, Store, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../shared/i18n/translations';

export interface AdminNavItem { path: string; label: TranslationKey; icon?: ReactNode }
export interface AdminNavGroup { key: string; label: TranslationKey; icon: ReactNode; items: AdminNavItem[] }

export const adminNavigation: AdminNavGroup[] = [
  { key: 'overview', label: 'adminNav.overview', icon: <ChartNoAxesCombined />, items: [{ path: '/admin/overview', label: 'adminNav.analytics' }] },
  { key: 'sellers', label: 'adminNav.sellers', icon: <Store />, items: [{ path: '/admin/sellers', label: 'adminNav.sellerList' }, { path: '/admin/shops', label: 'adminNav.kyc' }, { path: '/admin/payout-history', label: 'adminNav.commissionHistory' }] },
  { key: 'catalog', label: 'adminNav.catalog', icon: <PackageSearch />, items: [{ path: '/admin/products', label: 'adminNav.productModeration' }, { path: '/admin/categories', label: 'adminNav.categories' }, { path: '/admin/brands', label: 'adminNav.brands' }, { path: '/admin/attributes', label: 'adminNav.attributes' }] },
  { key: 'orders', label: 'adminNav.orders', icon: <ClipboardList />, items: [{ path: '/admin/orders', label: 'adminNav.globalOrders' }, { path: '/admin/transactions', label: 'adminNav.transactions' }] },
  { key: 'inventory', label: 'adminNav.inventory', icon: <Boxes />, items: [{ path: '/admin/warehouses', label: 'adminNav.warehouses' }, { path: '/admin/stock', label: 'adminNav.stock' }, { path: '/admin/transfers', label: 'adminNav.transfers' }] },
  { key: 'users', label: 'adminNav.users', icon: <Users />, items: [{ path: '/admin/users', label: 'adminNav.allUsers' }] },
  { key: 'marketing', label: 'adminNav.marketing', icon: <Megaphone />, items: [{ path: '/admin/banners', label: 'adminNav.banners' }, { path: '/admin/promocodes', label: 'adminNav.promocodes' }, { path: '/admin/collections', label: 'adminNav.collections' }] },
  { key: 'finance', label: 'adminNav.finance', icon: <Banknote />, items: [{ path: '/admin/finance', label: 'adminNav.payoutReports' }] },
  { key: 'moderation', label: 'adminNav.reviews', icon: <MessageSquareText />, items: [{ path: '/admin/reviews', label: 'adminNav.reviewModeration' }, { path: '/admin/disputes', label: 'adminNav.disputes' }] },
  { key: 'settings', label: 'adminNav.system', icon: <Settings />, items: [{ path: '/admin/system-settings', label: 'adminNav.systemHealth' }, { path: '/admin/audit-logs', label: 'adminNav.auditLogs' }] },
];

export const adminLeafRoutes = adminNavigation.flatMap(({ items }) => items);
export const adminRouteTitle = (pathname: string): TranslationKey =>
  adminLeafRoutes.find(({ path }) => pathname === path)?.label ?? 'adminNav.management';
