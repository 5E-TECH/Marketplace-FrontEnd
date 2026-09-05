import axios, { type InternalAxiosRequestConfig } from 'axios';
import { httpClient } from './httpClient';

interface HttpInterceptorOptions {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string>;
  onUnauthorized: () => void;
}

function isLoginRequest(url?: string): boolean {
  return Boolean(url?.endsWith('/auth/login'));
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

export function setupHttpInterceptors({
  getAccessToken,
  refreshAccessToken,
  onUnauthorized,
}: HttpInterceptorOptions): () => void {
  let refreshPromise: Promise<string> | null = null;
  const requestInterceptor = httpClient.interceptors.request.use((config) =>
    attachAccessToken(config, getAccessToken()),
  );

  const responseInterceptor = httpClient.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        !isLoginRequest(error.config?.url) && !isRefreshRequest(error.config?.url) && error.config
      ) {
        const config = error.config as InternalAxiosRequestConfig & { _authRetry?: boolean };
        if (!config._authRetry) {
          config._authRetry = true;
          try {
            refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null; });
            const token = await refreshPromise;
            config.headers.set('Authorization', `Bearer ${token}`);
            return httpClient(config);
          } catch { onUnauthorized(); }
        } else onUnauthorized();
      }

      return Promise.reject(error instanceof Error ? error : new Error('API xatosi'));
    },
  );

  return () => {
    httpClient.interceptors.request.eject(requestInterceptor);
    httpClient.interceptors.response.eject(responseInterceptor);
  };
}
