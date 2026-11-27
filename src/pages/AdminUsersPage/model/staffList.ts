import { roleInfo } from '../../../features/staff/model/roleCatalog';
import { accountStatus } from '../../../features/staff/model/staffRules';
import { STAFF_ROLES, isStaffRole, type StaffRole, type UserAccount } from '../../../features/staff/model/staffTypes';

/** «Foydalanuvchilar» yorliqlari (admin-foydalanuvchilar): URL `?tab=` — sukut «Xodimlar». */
export const USER_TABS = ['staff', 'affiliates', 'wholesalers', 'teams', 'roles'] as const;
export type UsersTab = (typeof USER_TABS)[number];
export const parseUsersTab = (value: string | null): UsersTab => ((USER_TABS as readonly string[]).includes(value ?? '') ? value as UsersTab : 'staff');

export type StatusFilter = '' | 'ACTIVE' | 'NEVER_LOGGED_IN' | 'BLOCKED';
export type LoginFilter = '' | 'password' | 'passwordCode';
export type SortOrder = 'name' | 'lastLoginDesc' | 'lastLoginAsc';

export interface StaffFilters {
  search: string;
  role: StaffRole | '';
  status: StatusFilter;
  login: LoginFilter;
}

export const STATUS_FILTERS: readonly Exclude<StatusFilter, ''>[] = ['ACTIVE', 'NEVER_LOGGED_IN', 'BLOCKED'];

export function parseFilters(params: URLSearchParams): StaffFilters {
  const role = params.get('role');
  const status = params.get('status');
  const login = params.get('login');
  return {
    search: params.get('q') ?? '',
    role: isStaffRole(role) ? role : '',
    status: (STATUS_FILTERS as readonly string[]).includes(status ?? '') ? status as StatusFilter : '',
    login: login === 'password' || login === 'passwordCode' ? login : '',
  };
}

export const parseSort = (value: string | null): SortOrder => (value === 'lastLoginDesc' || value === 'lastLoginAsc' ? value : 'name');
export const hasFilters = (filters: StaffFilters) => Boolean(filters.search.trim() || filters.role || filters.status || filters.login);

const digits = (value: string) => value.replace(/\D/g, '');

/** Qidiruv: ism, telefon (raqamlar) yoki ID («U-2087», «2087»). */
function matchesSearch(user: UserAccount, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  const queryDigits = digits(query);
  return user.name.toLocaleLowerCase().includes(query)
    || user.code.toLocaleLowerCase().includes(query)
    || (queryDigits.length >= 3 && digits(user.phone).includes(queryDigits));
}

export function matchesStaff(user: UserAccount, filters: StaffFilters): boolean {
  if (!matchesSearch(user, filters.search)) return false;
  // Roli noma'lum xodim faqat «Rol: Barchasi» va «Kirish: Barchasi» da (uning roli yo'q).
  if (user.role === null) return !filters.role && !filters.login && (!filters.status || filters.status === 'ACTIVE');
  if (filters.role && user.role !== filters.role) return false;
  if (filters.login && roleInfo(user.role).login !== filters.login) return false;
  if (filters.status) {
    const status = accountStatus(user);
    if (filters.status === 'ACTIVE' ? status !== 'ACTIVE' : status !== filters.status) return false;
  }
  return true;
}

export type GroupKey = StaffRole | 'UNKNOWN';

export interface StaffGroup {
  key: GroupKey;
  users: UserAccount[];
  /** Telefonda qisman ko'rsatilgan guruhning hamma a'zolari — sarlavhadagi sonlar shundan. */
  all?: UserAccount[];
}

const GROUP_ORDER: readonly GroupKey[] = ['UNKNOWN', ...STAFF_ROLES];
const loginTime = (user: UserAccount) => (user.lastLoginAt ? Date.parse(user.lastLoginAt) : -Infinity);

/** Rol bo'yicha guruhlar (dizayn tartibi: noma'lum rol, superadmin … operator); guruh ichida — ism yoki oxirgi kirish. */
export function groupStaff(users: readonly UserAccount[], sort: SortOrder): StaffGroup[] {
  const compare = (a: UserAccount, b: UserAccount) => {
    if (sort !== 'name') {
      const diff = sort === 'lastLoginDesc' ? loginTime(b) - loginTime(a) : loginTime(a) - loginTime(b);
      if (diff) return diff;
    }
    return a.name.localeCompare(b.name, 'uz');
  };
  return GROUP_ORDER.map((key) => ({
    key,
    users: users.filter((user) => (key === 'UNKNOWN' ? user.role === null : user.role === key)).sort(compare),
  })).filter((group) => group.users.length > 0);
}

/** Operator guruhi sarlavhasi: jamoalar (nazoratchilar), faol va bloklanganlar soni. */
export function operatorSummary(users: readonly UserAccount[]) {
  const supervisors = [...new Set(users.map((user) => user.team?.supervisorName).filter((name): name is string => Boolean(name)))];
  return {
    supervisors,
    active: users.filter((user) => !user.isBlocked).length,
    blocked: users.filter((user) => user.isBlocked).length,
  };
}

/** Telefonda dastlab ko'rsatiladigan xodimlar (admin-foydalanuvchilar.mobil: 11 / 20, «Yana 9 ta operator»). */
export const PHONE_PAGE = 11;

/** Telefon ro'yxati: birinchi `limit` ta xodim (guruh tartibida) va qolganlari qaysi guruhdan. */
export function phoneSlice(groups: readonly StaffGroup[], limit: number) {
  const total = groups.reduce((sum, group) => sum + group.users.length, 0);
  let left = limit;
  const visible = groups.map((group) => {
    const users = group.users.slice(0, Math.max(0, left));
    left -= users.length;
    return { ...group, users, all: group.users };
  }).filter((group) => group.users.length > 0);
  const shown = Math.min(total, limit);
  const shownByKey = new Map(visible.map((group) => [group.key, group.users.length]));
  const hiddenGroups = groups.filter((group) => group.users.length > (shownByKey.get(group.key) ?? 0));
  const remainingGroup = hiddenGroups.length === 1 ? hiddenGroups[0].key : null;
  return { groups: visible, shown, total, remaining: total - shown, remainingGroup };
}
