import { httpClient } from '../../../shared/api/httpClient';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import {
  isUserRole,
  type AuthUser,
  type AuthSession,
  type LoginCredentials,
  type LoginResponse,
  type LoginResult,
  type TwoFactorChallenge,
  type UpdateAuthProfilePayload,
  type UserRole,
  type AuthDeviceSession,
} from '../model/authTypes';
import { TwoFactorRequiredError } from '../lib/twoFactorRequiredError';
import { UnknownRoleError } from '../lib/unknownRoleError';
import { readTwoFactorChallenge } from './twoFactorApi';

interface LoginApiResponse {
  accessToken?: unknown;
}

function parseAuthUser(value: unknown): AuthUser {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Foydalanuvchi ma’lumoti noto‘g‘ri formatda');
  }

  // Rol bor, lekin frontend uni bilmaydi — format xatosi emas, alohida holat.
  if ('role' in value && typeof value.role === 'string' && value.role && !isUserRole(value.role)) {
    throw new UnknownRoleError(value.role, {
      id: 'id' in value ? value.id : undefined,
      name: 'name' in value ? value.name : undefined,
    });
  }

  const valid = (
    'id' in value &&
    typeof value.id === 'string' &&
    'role' in value &&
    isUserRole(value.role) &&
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

/**
 * Token tanada kelmasa (`AUTH_TOKENS_IN_BODY=false`) sessiya HttpOnly
 * cookie'da — `accessToken: null`. Cookie haqiqatan o'rnatilganini keyingi
 * `/auth/me` tasdiqlaydi; o'rnatilmagan bo'lsa login 401 bilan to'xtaydi.
 */
function parseLoginResponse(value: unknown): LoginResponse {
  const unwrapped = unwrapApiData(value);
  const data = (typeof unwrapped === 'object' && unwrapped !== null ? unwrapped : {}) as LoginApiResponse;
  if (data.accessToken === undefined || data.accessToken === null) {
    return { accessToken: null };
  }
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

/** Parol bosqichi: sessiya yoki (BE-26: admin, superadmin, moliya) 2FA bosqichi. */
async function login(credentials: LoginCredentials): Promise<LoginResponse | TwoFactorChallenge> {
  const { data } = await httpClient.post<unknown>('/auth/login', credentials);

  return readTwoFactorChallenge(data, credentials.phone) ?? parseLoginResponse(data);
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

/** Parol bilan kirish: sessiya ochiladi yoki 2FA bosqichi qaytadi (kod qadami, FE-27). */
export async function signIn(credentials: LoginCredentials): Promise<LoginResult> {
  const result = await login(credentials);
  if ('setupRequired' in result) return { kind: 'challenge', challenge: result };
  return { kind: 'session', session: await openSession(result) };
}

/** Faqat sessiya kutadigan joylar uchun: 2FA kerak bo'lsa — `TwoFactorRequiredError` (bosqich ichida). */
export async function authenticate(
  credentials: LoginCredentials,
): Promise<AuthSession> {
  const result = await signIn(credentials);
  if (result.kind === 'challenge') throw new TwoFactorRequiredError(result.challenge);
  return result.session;
}

/** Token olindi (parol yoki SMS kod, FE-04) — profilni yuklab sessiyani ochadi. */
export async function openSession(authSession: LoginResponse): Promise<AuthSession> {
  try {
    const user = await getCurrentUser(authSession.accessToken ?? undefined);
    return { ...authSession, user };
  } catch (error) {
    // Parol to'g'ri, rol noma'lum: sessiya ochiladi, panel menyusiz sababni ko'rsatadi (FE-01 TC3).
    if (error instanceof UnknownRoleError) return { ...authSession, user: null };
    throw error;
  }
}

export async function updateAuthProfile(
  payload: UpdateAuthProfilePayload,
): Promise<AuthUser> {
  const { data } = await httpClient.patch<unknown>('/auth/profile', payload);
  const value = unwrapApiData(data);
  const candidate = value && typeof value === 'object' && 'user' in value ? value.user : value;
  return parseAuthUser(candidate);
}

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
