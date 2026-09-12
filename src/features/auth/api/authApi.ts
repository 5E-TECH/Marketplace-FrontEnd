import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import type {
  AuthUser,
  AuthSession,
  LoginCredentials,
  LoginResponse,
  UpdateAuthProfilePayload,
  UpdateProfilePayload,
  UserRole,
  AuthDeviceSession,
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
  const value = unwrapApiData(data);
  const candidate = value && typeof value === 'object' && 'user' in value ? value.user : value;
  return parseAuthUser(candidate);
}

export const updateProfile = (payload: UpdateProfilePayload) => updateAuthProfile(payload);

export async function logout(): Promise<void> {
  await httpClient.post('/auth/logout');
}

export async function refreshAccessToken(refreshToken?: string): Promise<LoginResponse> {
  const { data } = await httpClient.post<unknown>('/auth/refresh', refreshToken ? { refreshToken } : {});
  return parseLoginResponse(data);
}
function parseSessions(value: unknown): AuthDeviceSession[] {
  const data = unwrapApiData(value); const list = Array.isArray(data) ? data : data && typeof data === 'object' && 'items' in data && Array.isArray(data.items) ? data.items : null;
  if (!list) throw new Error('Sessiyalar noto‘g‘ri formatda keldi');
  return list.map((item: unknown, index) => { const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}; const text = (key: string, fallback = '') => typeof row[key] === 'string' ? row[key] : fallback; return { id: text('id', String(index)), userAgent: text('userAgent', 'Noma’lum qurilma'), ipAddress: text('ipAddress', text('ip', '—')), createdAt: text('createdAt', new Date().toISOString()), lastUsedAt: text('lastUsedAt') || null, current: row.current === true || row.isCurrent === true }; });
}
export async function getAuthSessions(signal?: AbortSignal): Promise<AuthDeviceSession[]> { const { data } = await httpClient.get<unknown>('/auth/sessions', { signal }); return parseSessions(data); }
export async function revokeAuthSession(id: string): Promise<void> { await httpClient.delete(`/auth/sessions/${encodeURIComponent(id)}`); }
