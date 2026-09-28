import { StrictMode } from 'react';
import { CanceledError } from 'axios';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/router/AppRouter';
import { store } from './app/store/store';
import { refreshAccessToken } from './features/auth/api/authApi';
import {
  accessTokenRefreshed,
  impersonationEnded,
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
    // "Nomidan kirish" token'i refresh qilinmaydi, refresh cookie esa adminniki:
    // 401 — muddat tugagan, jimgina admin bo'lib qolmay, ochiq qaytamiz.
    if (store.getState().auth.impersonation) {
      store.dispatch(impersonationEnded('expired'));
      throw new CanceledError('Nomidan kirish muddati tugadi');
    }
    const sessionVersion = store.getState().auth.sessionVersion;
    const { accessToken } = await refreshAccessToken();
    if (store.getState().auth.sessionVersion !== sessionVersion) {
      throw new CanceledError('Sessiya o‘zgardi');
    }
    store.dispatch(accessTokenRefreshed({ accessToken }));
    return accessToken;
  },
  onUnauthorized: () => {
    const { accessToken, cookieSession, impersonation } = store.getState().auth;
    if (impersonation) {
      store.dispatch(impersonationEnded('expired'));
      return;
    }
    if (!accessToken && !cookieSession) {
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
