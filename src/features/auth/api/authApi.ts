import { httpClient } from '../../../shared/api/httpClient';
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  UserRole,
} from '../model/authTypes';

interface LoginApiResponse {
  accessToken?: unknown;
}

const USER_ROLES: UserRole[] = ['SELLER', 'BUYER', 'ADMIN', 'SUPERADMIN'];

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'role' in value &&
    typeof value.role === 'string' &&
    USER_ROLES.includes(value.role as UserRole) &&
    'name' in value &&
    typeof value.name === 'string' &&
    'phone' in value &&
    typeof value.phone === 'string' &&
    'isActive' in value &&
    typeof value.isActive === 'boolean' &&
    'isDeleted' in value &&
    typeof value.isDeleted === 'boolean'
  );
}

function parseLoginResponse(data: LoginApiResponse): LoginResponse {
  if (typeof data.accessToken !== 'string' || data.accessToken.length === 0) {
    throw new Error('Serverdan kutilmagan javob olindi');
  }

  return {
    accessToken: data.accessToken,
  };
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const { data } = await httpClient.post<LoginApiResponse>('/auth/login', credentials);

  return parseLoginResponse(data);
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await httpClient.get<unknown>('/auth/me');
  const candidate =
    typeof data === 'object' && data !== null && 'data' in data ? data.data : data;

  if (!isAuthUser(candidate)) {
    throw new Error('Foydalanuvchi ma’lumoti noto‘g‘ri formatda');
  }

  return {
    ...candidate,
    email:
      'email' in candidate && typeof candidate.email === 'string'
        ? candidate.email
        : null,
    avatarUrl:
      'avatarUrl' in candidate && typeof candidate.avatarUrl === 'string'
        ? candidate.avatarUrl
        : null,
  };
}

export async function logout(): Promise<void> {
  await httpClient.post('/auth/logout');
}
