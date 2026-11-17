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
