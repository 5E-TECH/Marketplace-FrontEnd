import axios, { type InternalAxiosRequestConfig } from 'axios';
import { httpClient } from './httpClient';

interface HttpInterceptorOptions {
  getAccessToken: () => string | null;
  onUnauthorized: () => void;
}

function isLoginRequest(url?: string): boolean {
  return Boolean(url?.endsWith('/auth/login'));
}

function attachAccessToken(
  config: InternalAxiosRequestConfig,
  accessToken: string | null,
): InternalAxiosRequestConfig {
  if (accessToken && !isLoginRequest(config.url)) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
}

export function setupHttpInterceptors({
  getAccessToken,
  onUnauthorized,
}: HttpInterceptorOptions): () => void {
  const requestInterceptor = httpClient.interceptors.request.use((config) =>
    attachAccessToken(config, getAccessToken()),
  );

  const responseInterceptor = httpClient.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        !isLoginRequest(error.config?.url)
      ) {
        onUnauthorized();
      }

      return Promise.reject(error instanceof Error ? error : new Error('API xatosi'));
    },
  );

  return () => {
    httpClient.interceptors.request.eject(requestInterceptor);
    httpClient.interceptors.response.eject(responseInterceptor);
  };
}
