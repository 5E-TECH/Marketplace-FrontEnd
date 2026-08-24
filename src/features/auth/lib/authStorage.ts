const ACCESS_TOKEN_KEY = 'elchi_access_token';
const AUTH_NOTICE_KEY = 'elchi_auth_notice';
const MAX_TOKEN_LENGTH = 16_384;

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
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      throw new Error('Sessiyani brauzerda saqlab bo‘lmadi');
    }
  },

  clear(): void {
    try {
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
