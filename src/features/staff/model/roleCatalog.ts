import type { UserRole } from '../../auth/model/authTypes';
import type { StaffRole } from './staffTypes';
import { ROLE_LABEL_KEYS } from '../../auth/lib/roleLabels';
import type { TranslationKey } from '../../../shared/i18n/translations';

/** Kirish usuli (admin-rollar «Kirish», kartadagi «Kirish usuli»). */
export type LoginKind = 'password' | 'passwordCode' | 'sms' | 'cabinetLater';

export interface RoleInfo {
  role: UserRole;
  label: TranslationKey;
  /** «Kim». */
  who: TranslationKey;
  /** «Asosiy ishi». */
  job: TranslationKey;
  login: LoginKind;
  /** Platforma xodimi; sotuvchi va optovik — tashqi foydalanuvchi. */
  staff: boolean;
}

/**
 * Sakkiz rol (TZ 3, admin-rollar «Sakkiz rol»): tartib — jadvaldagidek. Menyu bandlari bu yerda emas — marshrut
 * manifestidan (`getNavGroups`), shunda rol menyusi va ekrandagi ro'yxat bir xil.
 */
export const ROLE_CATALOG: readonly RoleInfo[] = [
  { role: 'SUPERADMIN', label: ROLE_LABEL_KEYS.SUPERADMIN, who: 'staff.who.superadmin', job: 'staff.job.superadmin', login: 'passwordCode', staff: true },
  { role: 'ADMIN', label: ROLE_LABEL_KEYS.ADMIN, who: 'staff.who.admin', job: 'staff.job.admin', login: 'passwordCode', staff: true },
  { role: 'FINANCE', label: ROLE_LABEL_KEYS.FINANCE, who: 'staff.who.finance', job: 'staff.job.finance', login: 'passwordCode', staff: true },
  { role: 'SUPERVISOR', label: ROLE_LABEL_KEYS.SUPERVISOR, who: 'staff.who.supervisor', job: 'staff.job.supervisor', login: 'password', staff: true },
  { role: 'WAREHOUSE', label: ROLE_LABEL_KEYS.WAREHOUSE, who: 'staff.who.warehouse', job: 'staff.job.warehouse', login: 'password', staff: true },
  { role: 'OPERATOR_LEAD', label: ROLE_LABEL_KEYS.OPERATOR_LEAD, who: 'staff.who.operator', job: 'staff.job.operator', login: 'password', staff: true },
  { role: 'AFFILIATE', label: ROLE_LABEL_KEYS.AFFILIATE, who: 'staff.who.affiliate', job: 'staff.job.affiliate', login: 'sms', staff: false },
  { role: 'WHOLESALER', label: ROLE_LABEL_KEYS.WHOLESALER, who: 'staff.who.wholesaler', job: 'staff.job.wholesaler', login: 'cabinetLater', staff: false },
];

const BY_ROLE = new Map(ROLE_CATALOG.map((info) => [info.role, info]));

export function roleInfo(role: UserRole): RoleInfo {
  const info = BY_ROLE.get(role);
  if (!info) throw new Error(`Rol katalogda yo'q: ${role}`);
  return info;
}

/** Ro'yxatdagi «Kirish» ustuni: «Parol» yoki «Parol + ilovadagi kod». */
export const LOGIN_LABEL_KEYS: Record<LoginKind, TranslationKey> = {
  password: 'staff.login.password',
  passwordCode: 'staff.login.passwordCode',
  sms: 'staff.login.sms',
  cabinetLater: 'staff.login.cabinetLater',
};

/** Kartadagi «Kirish usuli»: «Telefon va parol» yoki «Telefon, parol va ilovadagi kod». */
export const LOGIN_METHOD_KEYS: Record<LoginKind, TranslationKey> = {
  password: 'staff.loginMethod.password',
  passwordCode: 'staff.loginMethod.passwordCode',
  sms: 'staff.login.sms',
  cabinetLater: 'staff.login.cabinetLater',
};

/** Rol tanlovi tartibi (admin-foydalanuvchilar «Rol berish», karta D1, K1 «Yangi xodim»): operatordan superadmingacha. */
export const ROLE_CHOICES: readonly StaffRole[] = ['OPERATOR_LEAD', 'SUPERVISOR', 'WAREHOUSE', 'FINANCE', 'ADMIN', 'SUPERADMIN'];
