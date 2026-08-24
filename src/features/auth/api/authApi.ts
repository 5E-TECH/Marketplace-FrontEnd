import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type {
  AuthUser,
  AuthSession,
  LoginCredentials,
  LoginResponse,
  RegisterCredentials,
  UpdateAuthProfilePayload,
  UserRole,
} from '../model/authTypes';

interface LoginApiResponse {
  accessToken?: unknown;
}


const USER_ROLES: UserRole[] = [
  'SELLER',
  'OPERATOR',
  'BUYER',
  'ADMIN',
  'SUPERADMIN',
];

function parseAuthUser(value: unknown): AuthUser {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Foydalanuvchi ma’lumoti noto‘g‘ri formatda');
  }

  const valid = (
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
    (!('isDeleted' in value) || typeof value.isDeleted === 'boolean') &&
    (!('isBlocked' in value) || typeof value.isBlocked === 'boolean')
  );

  if (!valid) throw new Error('Foydalanuvchi ma’lumoti noto‘g‘ri formatda');

  return {
    id: value.id as string,
    role: value.role as UserRole,
    name: value.name as string,
    phone: value.phone as string,
    email: 'email' in value && typeof value.email === 'string' ? value.email : null,
    avatarUrl: 'avatarUrl' in value && typeof value.avatarUrl === 'string' ? value.avatarUrl : null,
    isActive: value.isActive as boolean,
    isDeleted: 'isDeleted' in value && typeof value.isDeleted === 'boolean' ? value.isDeleted : false,
    isBlocked: 'isBlocked' in value && typeof value.isBlocked === 'boolean' ? value.isBlocked : false,
  };
}

function parseLoginResponse(value: unknown): LoginResponse {
  const data = unwrapApiData(value) as LoginApiResponse;
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
  const { data } = await httpClient.post<unknown>('/auth/login', credentials);

  return parseLoginResponse(data);
}

export async function register(
  credentials: RegisterCredentials,
): Promise<void> {
  const { name, phone, password, email, shopName, shopDescription, address } = credentials;
  await httpClient.post('/sellers/register', {
    name,
    phone,
    password,
    ...(email ? { email } : {}),
    shopName,
    ...(shopDescription ? { shopDescription } : {}),
    ...(address ? { address } : {}),
  });
}

export async function getCurrentUser(
  accessToken?: string,
  signal?: AbortSignal,
): Promise<AuthUser> {
  const { data } = await httpClient.get<unknown>('/auth/me', {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    signal,
  });
  const unwrapped = unwrapApiData(data);
  const candidate =
    typeof unwrapped === 'object' && unwrapped !== null && 'user' in unwrapped
      ? unwrapped.user
      : unwrapped;

  return parseAuthUser(candidate);
}

export async function authenticate(
  credentials: LoginCredentials,
): Promise<AuthSession> {
  const authSession = await login(credentials);
  const user = await getCurrentUser(authSession.accessToken);

  return { ...authSession, user };
}

export async function updateAuthProfile(
  payload: UpdateAuthProfilePayload,
): Promise<AuthUser> {
  const { data } = await httpClient.patch<unknown>('/auth/profile', payload);
  return parseAuthUser(unwrapApiData(data));
}

export async function logout(): Promise<void> {
  await httpClient.post('/auth/logout');
}
