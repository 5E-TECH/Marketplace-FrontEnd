import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/router/AppRouter';
import { store } from './app/store/store';
import { authenticated, loggedOut } from './features/auth/model/authSlice';
import { refreshAccessToken } from './features/auth/api/authApi';
import { queryClient } from './shared/api/queryClient';
import { setupHttpInterceptors } from './shared/api/setupHttpInterceptors';
import './styles/global.css';

const ejectHttpInterceptors = setupHttpInterceptors({
  getAccessToken: () => store.getState().auth.accessToken,
  refreshAccessToken: async () => {
    const session = await refreshAccessToken();
    store.dispatch(authenticated(session));
    return session.accessToken;
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
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
