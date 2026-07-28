import axios, { type InternalAxiosRequestConfig } from 'axios';
import { httpClient } from './httpClient';

interface HttpInterceptorOptions {
  getAccessToken: () => string | null;
  onUnauthorized: () => void;
}

function attachAccessToken(
  config: InternalAxiosRequestConfig,
  accessToken: string | null,
): InternalAxiosRequestConfig {
  if (accessToken) {
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
      if (axios.isAxiosError(error) && error.response?.status === 401) {
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
