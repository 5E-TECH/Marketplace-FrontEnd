const ACCESS_TOKEN_KEY = 'elchi_access_token';

export const authStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  setAccessToken(accessToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  },
};
