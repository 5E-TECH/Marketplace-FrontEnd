import type { UserRole } from '../../../features/auth/model/authTypes';

/** «Audit: rol va bloklash» — foydalanuvchi ustidagi yozuvlar (BE-27 `entityType=User`: rol berish, bloklash, tiklash). */
export const AUDIT_PATH = '/admin/audit-logs?entityType=User';

/** Rol panelidagi «Xodimlarni ko'rish»: xodim roli — «Xodimlar» tabida rol filtri; sotuvchi va optovik — o'z tablari. */
export function peoplePath(role: UserRole): string {
  if (role === 'AFFILIATE') return '/admin/users?tab=affiliates';
  if (role === 'WHOLESALER') return '/admin/users?tab=wholesalers';
  return `/admin/users?role=${role}`;
}

/** Rol paneli manzili (telefonda — ichki sahifa, «‹ Rollar va ruxsatlar»). */
export const rolePath = (role: UserRole) => `/admin/users?tab=roles&role=${role}`;
export const ROLES_PATH = '/admin/users?tab=roles';
