import axios from 'axios';

const DEFAULT_API_URL = '/api';

/**
 * Production'da HTTPS majburiy: aks holda token va parollar ochiq ketadi.
 * Yagona istisno — domen hali olinmagan va API IP orqali sinalayotgan holat.
 * Unda `VITE_ALLOW_INSECURE_API=true` ni ataylab qo'yish kerak, ya'ni bu
 * tasodifan sodir bo'lmaydi.
 */
function resolveApiUrl(value: string | undefined): string {
  const apiUrl = value?.trim() || DEFAULT_API_URL;
  const insecureAllowed = import.meta.env.VITE_ALLOW_INSECURE_API === 'true';

  if (import.meta.env.PROD && /^http:\/\//i.test(apiUrl) && !insecureAllowed) {
    throw new Error(
      'Production API manzili HTTPS bo‘lishi kerak. ' +
        'Domen hali yo‘q bo‘lsa VITE_ALLOW_INSECURE_API=true bilan ataylab ruxsat bering.',
    );
  }

  if (insecureAllowed && import.meta.env.PROD) {
    console.warn(
      'DIQQAT: API HTTPS emas — token va parollar shifrlanmagan ketadi. ' +
        'Bu faqat sinov uchun.',
    );
  }

  return apiUrl.replace(/\/$/, '');
}

export const httpClient = axios.create({
  baseURL: resolveApiUrl(import.meta.env.VITE_API_URL),
  timeout: 10_000,
  // Access token Bearer sarlavhasida ketadi. Refresh token esa backend
  // tomonidan HttpOnly cookie'da beriladi (path: /api/v1/auth) — brauzer uni
  // faqat shu bayroq bilan saqlaydi va qaytaradi. JS cookie'ni o'qiy olmaydi.
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});
