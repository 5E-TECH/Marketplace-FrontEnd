import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/router/AppRouter';
import { store } from './app/store/store';
import { authStorage } from './features/auth/lib/authStorage';
import { loggedOut } from './features/auth/model/authSlice';
import { queryClient } from './shared/api/queryClient';
import { setupHttpInterceptors } from './shared/api/setupHttpInterceptors';
import './styles/global.css';

setupHttpInterceptors({
  getAccessToken: () => authStorage.getAccessToken(),
  onUnauthorized: () => {
    authStorage.clear();
    store.dispatch(loggedOut());
    queryClient.clear();
  },
});

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
