import { Banknote, ChartNoAxesCombined, ClipboardList, ListTree, Store, UserRoundCog, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../shared/i18n/translations';
import type { UserRole } from '../../auth/model/authTypes';

export interface AdminNavItem {
  path: string;
  label: TranslationKey;
  icon?: ReactNode;
  roles: readonly UserRole[];
}
export interface AdminNavGroup { key: string; label: TranslationKey; icon: ReactNode; items: AdminNavItem[] }

const ADMIN_ROLES: readonly UserRole[] = ['ADMIN', 'SUPERADMIN'];
const SUPERADMIN_ONLY: readonly UserRole[] = ['SUPERADMIN'];

export const adminNavigation: AdminNavGroup[] = [
  { key: 'overview', label: 'adminNav.overview', icon: <ChartNoAxesCombined />, items: [{ path: '/admin/overview', label: 'adminNav.overview', roles: ADMIN_ROLES }] },
  { key: 'accounts', label: 'adminNav.accounts', icon: <UserRoundCog />, items: [{ path: '/admin/users', label: 'adminNav.accounts', roles: ADMIN_ROLES }] },
  { key: 'shops', label: 'adminNav.shops', icon: <Store />, items: [{ path: '/admin/shops', label: 'adminNav.shops', roles: ADMIN_ROLES }] },
  { key: 'orders', label: 'adminNav.orders', icon: <ClipboardList />, items: [{ path: '/admin/orders', label: 'adminNav.orders', roles: ADMIN_ROLES }] },
  { key: 'categories', label: 'adminNav.categories', icon: <ListTree />, items: [{ path: '/admin/categories', label: 'adminNav.categories', roles: ADMIN_ROLES }] },
  { key: 'finance', label: 'adminNav.finance', icon: <Banknote />, items: [{ path: '/admin/finance', label: 'adminNav.finance', roles: SUPERADMIN_ONLY }] },
  { key: 'team', label: 'adminNav.team', icon: <Users />, items: [{ path: '/admin/team', label: 'adminNav.team', roles: SUPERADMIN_ONLY }] },
];

export const adminLeafRoutes = adminNavigation.flatMap(({ items }) => items);
export const getAdminNavigation = (role: UserRole | undefined): AdminNavGroup[] =>
  adminNavigation.filter(({ items }) => role && items.some((item) => item.roles.includes(role)));
export const adminRouteTitle = (pathname: string): TranslationKey =>
  adminLeafRoutes.find(({ path }) => pathname === path)?.label ?? 'adminNav.management';
