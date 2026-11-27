import type { UserRole } from '../../../features/auth/model/authTypes';
import { displayName } from '../../../features/staff/lib/staffFormat';
import type { AuditEntry, UserAccount } from '../../../features/staff/model/staffTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface RoleStat {
  /** null — son noma'lum (sotuvchi/optovik soni hali kelmagan). */
  count: number | null;
  users: UserAccount[];
  active: number;
  blocked: number;
}

/** Ro'yxatda nechta odamgacha ismlar ko'rsatiladi («Gulnora S., Ozoda B.»); ko'p bo'lsa — «12 faol · 1 bloklangan». */
const NAMES_IN_TABLE = 2;
/** Rol panelida shu songacha har odam qatori; ko'p bo'lsa — jami va tegishli tabga havola. */
export const PEOPLE_IN_PANEL = 5;

/** Har rol bo'yicha odamlar (admin-rollar «Foydalanuvchilar»): xodimlar ro'yxatidan, sotuvchi va optovik — jami sondan. */
export function roleStats(staff: readonly UserAccount[] | undefined, totals: { AFFILIATE?: number; WHOLESALER?: number }): Record<UserRole, RoleStat> {
  const stat = (role: UserRole): RoleStat => {
    if (role === 'AFFILIATE' || role === 'WHOLESALER') return { count: totals[role] ?? null, users: [], active: 0, blocked: 0 };
    const users = (staff ?? []).filter((user) => user.role === role);
    const blocked = users.filter((user) => user.isBlocked).length;
    return { count: staff ? users.length : null, users, active: users.length - blocked, blocked };
  };
  return {
    SUPERADMIN: stat('SUPERADMIN'), ADMIN: stat('ADMIN'), FINANCE: stat('FINANCE'), SUPERVISOR: stat('SUPERVISOR'),
    WAREHOUSE: stat('WAREHOUSE'), OPERATOR_LEAD: stat('OPERATOR_LEAD'), AFFILIATE: stat('AFFILIATE'), WHOLESALER: stat('WHOLESALER'),
  };
}

/** «Akmal S.», «Nodira K. (siz)», «Gulnora S., Ozoda B.», «12 faol · 1 bloklangan», «o‘zi ro‘yxatdan o‘tadi». */
export function peopleSummary(role: UserRole, stat: RoleStat, viewerId: string, t: T): string {
  if (role === 'AFFILIATE') return t('staff.roles.selfRegister');
  if (role === 'WHOLESALER') return t('staff.roles.adminAdds');
  if (stat.count === null) return '';
  // Backend superadminni ro'yxatda yashiradi (taklif `role=SUPERADMIN`) — «yo'q» deyilmaydi.
  if (stat.count === 0) return t(role === 'SUPERADMIN' ? 'staff.roles.hidden' : 'staff.roles.nobody');
  if (stat.count <= NAMES_IN_TABLE) {
    return [...stat.users].sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .map((user) => (user.id === viewerId ? `${displayName(user)} ${t('staff.you')}` : displayName(user))).join(', ');
  }
  return stat.blocked ? t('staff.roles.activeBlocked', { active: stat.active, blocked: stat.blocked }) : t('staff.roles.active', { active: stat.active });
}

/** Ekrandagi son: superadmin backendda yashirin bo'lsa — «—». */
export const countText = (role: UserRole, stat: RoleStat) => (stat.count === null || (stat.count === 0 && role === 'SUPERADMIN') ? '—' : String(stat.count));

const ROLE_ACTIONS = new Set(['user.role.update', 'admin.team.role.update', 'admin.team.create']);

/** Rol qachon berilgan: auditdagi eng so'nggi rol yozuvi (`after.role` shu rol). */
export function roleGrantedAt(entries: readonly AuditEntry[] | undefined, role: UserRole): string | null {
  const entry = entries?.find((item) => {
    if (!ROLE_ACTIONS.has(item.action)) return false;
    const after = item.meta.after;
    return typeof after === 'object' && after !== null && (after as Record<string, unknown>).role === role;
  });
  return entry?.createdAt ?? null;
}
