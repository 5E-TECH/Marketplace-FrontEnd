import axios from 'axios';

const DEFAULT_API_URL = '/api';

/**
 * Production'da HTTPS majburiy: aks holda token va parollar ochiq ketadi.
 *
 * CHETLASHUV YO'Q (C5.3). Ilgari `VITE_ALLOW_INSECURE_API=true` bilan HTTP'ga
 * ruxsat berish mumkin edi — u domen olinmagan paytdagi vaqtinchalik yechim
 * edi. Domen (elchimarket.uz) 2026-09 dan beri ishlaydi, shuning uchun bayroq
 * butunlay olib tashlandi: qolsa, kimdir uni yoqib qo'yishi va production
 * jimgina HTTPS'siz qolishi mumkin edi.
 */
function resolveApiUrl(value: string | undefined): string {
  const apiUrl = value?.trim() || DEFAULT_API_URL;

  if (import.meta.env.PROD && /^http:\/\//i.test(apiUrl)) {
    throw new Error(
      'Production API manzili HTTPS bo‘lishi kerak: ' + apiUrl,
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
