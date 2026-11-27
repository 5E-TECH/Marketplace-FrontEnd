import type { UserRole } from '../../auth/model/authTypes';

/**
 * Platforma xodimlari (BE-05 `STAFF_ROLES`) — «Foydalanuvchilar» ro'yxatidagi guruhlar tartibida
 * (admin-foydalanuvchilar: Superadmin, Admin, Moliya, Nazoratchi, Omborchi, Operator).
 */
export const STAFF_ROLES = ['SUPERADMIN', 'ADMIN', 'FINANCE', 'SUPERVISOR', 'WAREHOUSE', 'OPERATOR_LEAD'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (role: unknown): role is StaffRole => (STAFF_ROLES as readonly unknown[]).includes(role);

export interface PersonRef {
  id: string;
  name: string;
}

/** Operator jamoasi (taklif): nazoratchi kuzatadi; lidlar jamoaga bo'linmaydi. */
export interface TeamRef {
  id: string;
  supervisorId: string;
  supervisorName: string;
}

/**
 * `GET /admin/users` elementi va xodim kartasi. Backend maydonlari: id, role, ism, telefon, faol/blok, `totpEnabledAt`,
 * yaratilgan. Qolganlari — taklif (docs/api-taklif/fe-15-admin-foydalanuvchilar.md): kelmasa `undefined` (ekranda «—»).
 */
export interface UserAccount {
  id: string;
  /** Ekrandagi ID: `U-1051`. */
  code: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  /** null — backend roli frontendga noma'lum («Noma'lum rol»: menyu ochilmaydi). */
  role: UserRole | null;
  roleRaw: string;
  isActive: boolean;
  isBlocked: boolean;
  /** BE-26: ilova ulangan payt; null — ulanmagan. */
  totpEnabledAt: string | null;
  createdAt: string;
  /** null — hisob ochilgan, lekin hali kirilmagan. */
  lastLoginAt?: string | null;
  createdBy?: PersonRef | null;
  passwordSetAt?: string | null;
  /** Vaqtinchalik parol amalda (birinchi kirishgacha yoki tiklangach): berilgan va SMS ketgan payt. */
  temporaryPassword?: { issuedAt: string; smsSentAt: string | null } | null;
  /** Superadmin 2FA ni tiklagan, xodim hali qayta ulamagan. */
  twoFactorReset?: { at: string; by: string } | null;
  block?: { at: string; by: string; reason: string | null } | null;
  team?: TeamRef | null;
  /** Taklif (fe-15 §11): sotuvchi sahifalari — jami va to'xtatilgani. */
  affiliate?: { streams: number; stoppedStreams: number } | null;
  /** Taklif (fe-15 §11): «Sotuvchilar» bo'limidagi jazo — ogohlantirish yoki ushlab turish va qachondan. */
  sanction?: { kind: 'WARNING' | 'HOLD'; since: string } | null;
}

/** «Sotuvchilar» yorlig'idagi hisob holati (blok ustun, keyin jazo). */
export type SellerStatus = 'ACTIVE' | 'WARNING' | 'HOLD' | 'BLOCKED';

/** Ro'yxat va kartadagi holat (admin-foydalanuvchilar, admin-foydalanuvchi-karta). */
export type AccountStatus = 'ACTIVE' | 'BLOCKED' | 'NEVER_LOGGED_IN' | 'INACTIVE' | 'UNKNOWN_ROLE';

/** «Ikki bosqichli kirish» ustuni. */
export type TwoFactorState = 'CONNECTED' | 'RESET' | 'PENDING' | 'NOT_REQUIRED';

export interface UsersPage {
  items: UserAccount[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StaffListFilter {
  /** Qaysi rollar so'raladi (filtr «Rol», «Kirish»); sukut — hamma xodim roli. */
  roles: readonly StaffRole[];
  search?: string;
  blocked?: boolean;
}

export interface AccountsPageParams {
  role: 'AFFILIATE' | 'WHOLESALER';
  search?: string;
  blocked?: boolean;
  /** Faqat sotuvchilar: BLOCKED → `blocked=true`; qolganlari — taklif `sanction`. */
  status?: SellerStatus;
  page: number;
  limit: number;
}

export interface CreateStaffInput {
  firstName: string;
  lastName: string;
  /** `+998XXXXXXXXX`. */
  phone: string;
  role: StaffRole;
  teamId?: string | null;
  /** Taklif (fe-15 §13): operatorning ish joyi — softfon hisobi shu bilan ochiladi. */
  workspace?: 'BROWSER' | 'SIP' | null;
}

/**
 * `POST /admin/team` natijasi. Backend vaqtinchalik parolni javobda bir marta beradi (SMS yo'q); taklif — SMS
 * (`smsSent`). SMS ketmagan bo'lsa parol adminga bir marta ko'rsatiladi.
 */
export interface CreateStaffResult {
  user: UserAccount;
  temporaryPassword: string | null;
  smsSent: boolean;
}

export type PasswordDelivery = 'SMS' | 'SHOW';

export interface PasswordResetResult {
  temporaryPassword: string | null;
  smsSent: boolean;
}

/** Taklif: xodimning faol sessiyasi. */
export interface StaffSession {
  id: string;
  browser: string;
  os: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
  /** Ko'rayotgan odamning o'z joriy sessiyasi («shu qurilma»). */
  current: boolean;
}

export type LoginOutcome = 'SUCCESS' | 'WRONG_PASSWORD' | 'WRONG_CODE' | 'BLOCKED';
export type LoginMethod = 'PASSWORD' | 'PASSWORD_CODE' | 'RECOVERY_CODE' | 'SMS';

/** Taklif: kirishlar tarixi qatori. */
export interface LoginEvent {
  at: string;
  outcome: LoginOutcome;
  method: LoginMethod;
  browser: string;
  os: string;
  ip: string;
}

/** Taklif: operatorlar jamoasi (`GET /admin/teams`). */
export interface Team {
  id: string;
  supervisor: PersonRef;
  operatorCount: number;
  createdAt: string;
}

/** Audit yozuvi (BE-27 `GET /admin/audit`): kartadagi «Oxirgi amallari». */
export interface AuditEntry {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  meta: Record<string, unknown>;
}
