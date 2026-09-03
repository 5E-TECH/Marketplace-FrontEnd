import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/router/AppRouter';
import { store } from './app/store/store';
import { refreshAccessToken } from './features/auth/api/authApi';
import {
  accessTokenRefreshed,
  loggedOut,
} from './features/auth/model/authSlice';
import { queryClient } from './shared/api/queryClient';
import { setupHttpInterceptors } from './shared/api/setupHttpInterceptors';
import { ErrorBoundary } from './shared/ui/ErrorBoundary/ErrorBoundary';
import './styles/global.css';

const ejectHttpInterceptors = setupHttpInterceptors({
  getAccessToken: () => store.getState().auth.accessToken,
  // Access token muddati tuganda (odatda 1 soat) sessiyani uzmaymiz:
  // HttpOnly refresh cookie orqali yangi token olinadi va so'rov qaytariladi.
  refreshAccessToken: async () => {
    const { accessToken } = await refreshAccessToken();
    store.dispatch(accessTokenRefreshed({ accessToken }));
    return accessToken;
  },
  onUnauthorized: () => {
    if (!store.getState().auth.accessToken) {
      return;
    }

    store.dispatch(loggedOut());
    queryClient.clear();
  },
});

if (import.meta.hot) {
  import.meta.hot.dispose(ejectHttpInterceptors);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element topilmadi');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
