import { matchPath } from 'react-router-dom';
import type { UserRole } from '../../features/auth/model/authTypes';
import type { TranslationKey } from '../../shared/i18n/translations';
import { appRoutes, roleShells, type AppRoute, type RoleShell } from './routeManifest';

// Statik yo'l (`/admin/users/new`) parametrli yo'ldan (`/admin/users/:userId`) oldin tekshiriladi.
const staticRoutes = appRoutes.filter(({ path }) => !path.includes(':'));
const paramRoutes = appRoutes.filter(({ path }) => path.includes(':'));
const routesByPath = new Map(appRoutes.map((route) => [route.path, route]));

function toPathname(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] || '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function findRoute(path: string): AppRoute | undefined {
  const pathname = toPathname(path);
  return (
    staticRoutes.find((route) => route.path === pathname) ??
    paramRoutes.find((route) => matchPath({ path: route.path, end: true }, pathname))
  );
}

/** Menyuda faol bo'ladigan bo'lim: ichki sahifa uchun uning ota bo'limi. */
export function findNavSection(path: string): AppRoute | undefined {
  const route = findRoute(path);
  return route?.section ? routesByPath.get(route.section) : route;
}

/** Manifestda yo'q yo'l uchun `true` — uni panel ichidagi 404 ko'rsatadi. */
export function canAccessRoute(path: string, role: UserRole): boolean {
  const route = findRoute(path);
  return route ? route.roles.includes(role) : true;
}

export function getRoleShell(role: UserRole): RoleShell {
  return roleShells[role];
}

/** Login, `/` va 403/404 dan qaytish manzili. */
export function getRoleHome(role: UserRole): string {
  return roleShells[role].home;
}

export interface NavGroup {
  /** Faqat admin menyusida (karkas-E 1.4); boshqa rollarda `undefined`. */
  label?: TranslationKey;
  routes: AppRoute[];
}

/** Rol menyusi — manifest tartibida, guruhlarga bo'lingan. */
export function getNavGroups(role: UserRole): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const route of appRoutes) {
    if (!route.navIcon || !(route.navRoles ?? route.roles).includes(role)) continue;
    const last = groups.at(-1);
    if (last && last.label === route.navGroup) last.routes.push(route);
    else groups.push({ label: route.navGroup, routes: [route] });
  }
  return groups;
}

/** Sahifa bundle'ini oldindan yuklaydi (menyuga kursor kelganda, bosishdan oldin). */
export function prefetchRoute(path: string): void {
  const route = findRoute(path);
  if (route) void route.load();
}
