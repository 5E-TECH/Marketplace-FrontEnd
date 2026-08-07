import axios from 'axios';

const DEFAULT_API_URL = '/api';

function resolveApiUrl(value: string | undefined): string {
  const apiUrl = value?.trim() || DEFAULT_API_URL;

  if (import.meta.env.PROD && /^http:\/\//i.test(apiUrl)) {
    throw new Error('Production API manzili HTTPS bo‘lishi kerak');
  }

  return apiUrl.replace(/\/$/, '');
}

export const httpClient = axios.create({
  baseURL: resolveApiUrl(import.meta.env.VITE_API_URL),
  timeout: 10_000,
  // Hozirgi auth Bearer token orqali ishlaydi; cross-site cookie yubormaymiz.
  withCredentials: false,
  headers: {
    Accept: 'application/json',
  },
});
