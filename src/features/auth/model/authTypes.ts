export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
  email?: string;
  shopName: string;
  shopDescription?: string;
  address?: string;
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
}

export interface AuthSession extends LoginResponse {
  user: AuthUser;
}
