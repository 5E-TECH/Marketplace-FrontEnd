export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
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

/** `PATCH /auth/profile` — barcha maydon ixtiyoriy (UpdateProfileDto). */
export type UpdateProfilePayload = UpdateAuthProfilePayload;
