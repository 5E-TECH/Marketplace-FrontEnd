import axios, { type InternalAxiosRequestConfig } from 'axios';
import { httpClient } from './httpClient';

interface HttpInterceptorOptions {
  getAccessToken: () => string | null;
  /** Refresh cookie orqali yangi access token oladi va uni saqlaydi. */
  refreshAccessToken: () => Promise<string>;
  onUnauthorized: () => void;
}

/** Refresh urinishidan keyin bir marta qayta yuborilganini belgilaydi. */
interface RetriableConfig extends InternalAxiosRequestConfig {
  retriedAfterRefresh?: boolean;
}

function endsWithPath(url: string | undefined, path: string): boolean {
  return Boolean(url?.endsWith(path));
}

function isLoginRequest(url?: string): boolean {
  return endsWithPath(url, '/auth/login');
}

/**
 * Bu endpointlarda 401 kelishi normal holat — ularni refresh bilan qayta
 * urinish cheksiz siklga olib keladi.
 */
function skipsRefresh(url?: string): boolean {
  return (
    isLoginRequest(url) ||
    endsWithPath(url, '/auth/refresh') ||
    endsWithPath(url, '/auth/logout')
  );
}
function isRefreshRequest(url?: string): boolean { return Boolean(url?.endsWith('/auth/refresh')); }

function attachAccessToken(
  config: InternalAxiosRequestConfig,
  accessToken: string | null,
): InternalAxiosRequestConfig {
  if (accessToken && !isLoginRequest(config.url) && !isRefreshRequest(config.url)) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('API xatosi');
}

export function setupHttpInterceptors({
  getAccessToken,
  refreshAccessToken,
  onUnauthorized,
}: HttpInterceptorOptions): () => void {
  // Bir vaqtda bir nechta so'rov 401 olsa, refresh faqat bir marta yuboriladi;
  // qolganlari o'sha va'daga ulanadi.
  let pendingRefresh: Promise<string> | null = null;

  const refreshOnce = (): Promise<string> => {
    pendingRefresh ??= refreshAccessToken().finally(() => {
      pendingRefresh = null;
    });

    return pendingRefresh;
  };
  const requestInterceptor = httpClient.interceptors.request.use((config) =>
    attachAccessToken(config, getAccessToken()),
  );

  const responseInterceptor = httpClient.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        return Promise.reject(toError(error));
      }

      const config = error.config as RetriableConfig | undefined;

      if (!config || config.retriedAfterRefresh || skipsRefresh(config.url)) {
        if (!isLoginRequest(config?.url)) {
          onUnauthorized();
        }

        return Promise.reject(toError(error));
      }

      config.retriedAfterRefresh = true;

      try {
        const accessToken = await refreshOnce();
        config.headers.set('Authorization', `Bearer ${accessToken}`);
      } catch (refreshError) {
        if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
          onUnauthorized();
        }
        return Promise.reject(toError(refreshError));
      }
      // Retried request errors belong to that request, not to token refresh.
      return httpClient.request(config);
    },
  );

  return () => {
    httpClient.interceptors.request.eject(requestInterceptor);
    httpClient.interceptors.response.eject(responseInterceptor);
  };
}
