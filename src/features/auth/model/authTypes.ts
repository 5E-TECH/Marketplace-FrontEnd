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

export type UserRole = 'SELLER' | 'OPERATOR' | 'BUYER' | 'ADMIN' | 'SUPERADMIN';

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
  email?: string;
  avatarUrl?: string;
  password?: string;
}

export interface AuthSession extends LoginResponse {
  user: AuthUser;
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
