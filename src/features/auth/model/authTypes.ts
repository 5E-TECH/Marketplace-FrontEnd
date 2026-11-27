export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface LoginResponse {
  /**
   * `null` — backend tokenni tanada bermadi (`AUTH_TOKENS_IN_BODY=false`):
   * sessiya faqat HttpOnly cookie'da, JS token ko'rmaydi va saqlamaydi.
   */
  accessToken: string | null;
}

/**
 * Lid-sotuv modelidagi 8 rol (BE-05). Eski SELLER, OPERATOR va BUYER yo'q:
 * mijoz tizim foydalanuvchisi emas, do'kon xodimi o'rnini lid operatori oldi.
 * Rollar OpenAPI'ga chiqmaydi, shuning uchun ro'yxat shu yerda yagona.
 */
export const USER_ROLES = [
  'AFFILIATE',
  'WHOLESALER',
  'OPERATOR_LEAD',
  'SUPERVISOR',
  'WAREHOUSE',
  'FINANCE',
  'ADMIN',
  'SUPERADMIN',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** BE-26 (`two-factor.gate`): parol va ilovadagi kod bilan kiradigan rollar (`ADMIN_2FA=on` bo'lganda). */
export const TWO_FACTOR_ROLES: readonly UserRole[] = ['ADMIN', 'SUPERADMIN', 'FINANCE'];

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isDeleted: boolean;
  isBlocked: boolean;
  /** Taklif (fe-15 §15): oxirgi rol o'zgarishi — «Rolingiz o‘zgardi» sahifasidagi «O‘zgartirdi» qatori. */
  roleChange?: RoleChangeInfo | null;
  /** Taklif (fe-15 §15): operator jamoasi — «Jamoa: nazoratchi Rustam Q.». */
  team?: { supervisorName: string } | null;
}

/** Rol o'zgarishi: `before` — `null`, agar oldin frontend bilmagan rol bo'lgan («Noma’lum rol»). */
export interface RoleChangeInfo {
  before: UserRole | null;
  after: UserRole;
  at: string | null;
  by: { name: string; role: UserRole | null } | null;
}

/** `PATCH /auth/profile` — barcha maydon ixtiyoriy (UpdateProfileDto). */
export interface UpdateAuthProfilePayload {
  name?: string;
  phone?: string;
  avatarUrl?: string;
  password?: string;
}

export interface AuthSession extends LoginResponse {
  /** `null` — rol noma'lum: sessiya bor, profilni `/auth/me` qayta tekshiradi. */
  user: AuthUser | null;
}

/**
 * BE-26 (FE-27): admin, superadmin va moliya — paroldan keyin sessiya o'rniga 2FA bosqichi. `token` — 5 daqiqalik
 * `challengeToken` (sessiya emas); keyingi qadamlar shu bilan.
 */
export interface TwoFactorChallenge {
  token: string;
  /** 2FA hali ulanmagan (birinchi kirish yoki superadmin tiklagan) — avval QR bilan ulash (umumiy-2fa-ulash). */
  setupRequired: boolean;
  /** Parol kiritilgan raqam — karta va zaxira kodlar faylida. */
  phone: string;
  /** Taklif (fe-27 §2): kim kirayapti — «Nodira K. · Admin»; kelmasa karta telefonni ko'rsatadi. */
  user: { name: string; role: UserRole } | null;
  /** Taklif (fe-27 §2): superadmin tiklagan — «2FA tiklandi» xabari. */
  reset: { by: string; at: string } | null;
}

/** Parol bosqichi natijasi: sessiya ochildi yoki 2FA kerak. */
export type LoginResult = { kind: 'session'; session: AuthSession } | { kind: 'challenge'; challenge: TwoFactorChallenge };

/** `POST /auth/2fa/setup`: QR shu `otpauthUrl` dan chiziladi, `secret` — qo'lda kiritish uchun kalit. */
export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
}
export interface AuthDeviceSession { id: string; userAgent: string; ipAddress: string; createdAt: string; lastUsedAt: string | null; current: boolean }

/** `POST /admin/users/:id/impersonate` natijasi (15 daqiqalik, refresh qilinmaydigan token). */
export interface ImpersonationGrant {
  token: string;
  expiresAt: string;
  user: { id: string; name: string; role: UserRole };
}

/** Faol "nomidan kirish": tugaganda admin sessiyasi va sahifasi tiklanadi. */
export interface ImpersonationSession extends ImpersonationGrant {
  returnTo: string;
  admin: { accessToken: string | null; cookieSession: boolean };
}

export type ImpersonationEndReason = 'exited' | 'expired';
