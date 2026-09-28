import type { ImpersonationSession, UserRole } from '../model/authTypes';

const ACCESS_TOKEN_KEY = 'elchi_access_token';
const AUTH_NOTICE_KEY = 'elchi_auth_notice';
/** Cookie sessiya belgisi: sahifa yangilanganda sessiyani `/auth/me` bilan tiklash uchun. Token emas. */
const COOKIE_SESSION_KEY = 'elchi_cookie_session';
const MAX_TOKEN_LENGTH = 16_384;
const IMPERSONATION_KEY = 'elchi_impersonation';
const IMPERSONATION_ROLES: readonly UserRole[] = ['SELLER', 'OPERATOR', 'BUYER', 'ADMIN', 'SUPERADMIN'];

type StoredImpersonation = Omit<ImpersonationSession, 'admin'>;

function parseStoredImpersonation(raw: string | null): StoredImpersonation | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredImpersonation>;
    const user = value.user;
    if (
      !isValidStoredToken(value.token ?? null) ||
      typeof value.expiresAt !== 'string' || Number.isNaN(Date.parse(value.expiresAt)) ||
      typeof value.returnTo !== 'string' || !value.returnTo.startsWith('/') ||
      !user || typeof user.id !== 'string' || typeof user.name !== 'string' || !IMPERSONATION_ROLES.includes(user.role)
    ) return null;
    return { token: value.token as string, expiresAt: value.expiresAt, returnTo: value.returnTo, user: { id: user.id, name: user.name, role: user.role } };
  } catch {
    return null;
  }
}

function isValidStoredToken(value: string | null): value is string {
  return Boolean(value && value.length <= MAX_TOKEN_LENGTH && !/\s/.test(value));
}

export const authStorage = {
  getAccessToken(): string | null {
    try {
      const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);

      if (isValidStoredToken(accessToken)) {
        return accessToken;
      }

      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      return null;
    } catch {
      return null;
    }
  },

  setAccessToken(accessToken: string): void {
    if (!isValidStoredToken(accessToken)) {
      throw new Error('Access token formati noto‘g‘ri');
    }

    try {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      sessionStorage.removeItem(COOKIE_SESSION_KEY);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      throw new Error('Sessiyani brauzerda saqlab bo‘lmadi');
    }
  },

  hasCookieSession(): boolean {
    try {
      return sessionStorage.getItem(COOKIE_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  },

  setCookieSession(): void {
    try {
      sessionStorage.setItem(COOKIE_SESSION_KEY, '1');
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      throw new Error('Sessiyani brauzerda saqlab bo‘lmadi');
    }
  },

  /** Muddati o'tmagan saqlangan "nomidan kirish" (sahifa yangilanganda). */
  getImpersonation(now = Date.now()): StoredImpersonation | null {
    try {
      const stored = parseStoredImpersonation(sessionStorage.getItem(IMPERSONATION_KEY));
      if (stored && Date.parse(stored.expiresAt) > now) return stored;
      sessionStorage.removeItem(IMPERSONATION_KEY);
      return null;
    } catch {
      return null;
    }
  },

  setImpersonation(value: StoredImpersonation): void {
    try {
      sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(value));
    } catch {
      throw new Error('Sessiyani brauzerda saqlab bo‘lmadi');
    }
  },

  clearImpersonation(): void {
    try {
      sessionStorage.removeItem(IMPERSONATION_KEY);
    } catch {
      // Storage bloklangan bo‘lsa Redux holati baribir tozalanadi.
    }
  },

  clear(): void {
    try {
      sessionStorage.removeItem(IMPERSONATION_KEY);
      sessionStorage.removeItem(COOKIE_SESSION_KEY);
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // Storage bloklangan bo‘lsa Redux sessiyasi baribir tozalanadi.
    }
  },

  setNotice(notice: string): void {
    try {
      sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
    } catch {
      // Xabar saqlanmasa auth jarayoniga ta’sir qilmaydi.
    }
  },

  consumeNotice(): string | null {
    try {
      const notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
      sessionStorage.removeItem(AUTH_NOTICE_KEY);
      return notice;
    } catch {
      return null;
    }
  },
};
