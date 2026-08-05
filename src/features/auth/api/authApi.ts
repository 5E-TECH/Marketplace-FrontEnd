import { httpClient } from '../../../shared/api/httpClient';
import type {
  AuthUser,
  AuthSession,
  LoginCredentials,
  LoginResponse,
  RegisterCredentials,
  UserRole,
} from '../model/authTypes';
import { canAccessSellerCabinet } from '../lib/sellerAccess';

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
  if (
    typeof data.accessToken !== 'string' ||
    data.accessToken.length === 0 ||
    data.accessToken.length > 16_384 ||
    /\s/.test(data.accessToken)
  ) {
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

export async function register(
  credentials: RegisterCredentials,
): Promise<void> {
  await httpClient.post('/auth/register', credentials);
}

export async function getCurrentUser(accessToken?: string): Promise<AuthUser> {
  const { data } = await httpClient.get<unknown>('/auth/me', {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const unwrapped =
    typeof data === 'object' && data !== null && 'data' in data ? data.data : data;
  const candidate =
    typeof unwrapped === 'object' && unwrapped !== null && 'user' in unwrapped
      ? unwrapped.user
      : unwrapped;

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

export async function authenticate(
  credentials: LoginCredentials,
): Promise<AuthSession> {
  const authSession = await login(credentials);
  const user = await getCurrentUser(authSession.accessToken);

  if (!canAccessSellerCabinet(user)) {
    throw new Error('Bu akkaunt orqali seller kabinetiga kirish mumkin emas');
  }

  return { ...authSession, user };
}

export async function logout(): Promise<void> {
  await httpClient.post('/auth/logout');
}
