import { StrictMode } from 'react';
import { CanceledError } from 'axios';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/router/AppRouter';
import { store } from './app/store/store';
import { refreshAccessToken } from './features/auth/api/authApi';
import { lockAccountOf, readAccountLock } from './features/auth/lib/accountLock';
import { listenToPeers, requestSessionFromPeers, sessionHint, withRefreshLock } from './features/auth/lib/sessionSync';
import {
  accessTokenRefreshed,
  accountLocked,
  authenticated,
  impersonationEnded,
  loggedOut,
  sessionExpired,
} from './features/auth/model/authSlice';
import { queryClient } from './shared/api/queryClient';
import { setupHttpInterceptors } from './shared/api/setupHttpInterceptors';
import { ErrorBoundary } from './shared/ui/ErrorBoundary/ErrorBoundary';
// E dizayn shrifti o'zimizda: CSP `font-src 'self'` tashqi shriftga ruxsat bermaydi.
import '@fontsource-variable/manrope';
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
    // Refresh token har safar almashadi: tablar navbat bilan yangilaydi (sessionSync).
    const { accessToken } = await withRefreshLock(() => refreshAccessToken());
    if (store.getState().auth.sessionVersion !== sessionVersion) {
      throw new CanceledError('Sessiya o‘zgardi');
    }
    store.dispatch(accessTokenRefreshed({ accessToken }));
    return accessToken;
  },
  onUnauthorized: (error) => {
    const { accessToken, cookieSession, impersonation, user } = store.getState().auth;
    if (impersonation) {
      store.dispatch(impersonationEnded('expired'));
      return;
    }
    if (!accessToken && !cookieSession) {
      return;
    }

    // Hisob bloklangan yoki nofaol (taklif `errorCode`, FE-15): qayta kirish o'rniga sabab — oyna yoki sahifa.
    const lock = readAccountLock(error, lockAccountOf(user));
    if (lock) {
      store.dispatch(accountLocked(lock));
      return;
    }

    // Foydalanuvchi ma'lum bo'lsa sahifa yopilmaydi — ustida qayta kirish oynasi (umumiy-sessiya).
    if (user) {
      store.dispatch(sessionExpired());
      return;
    }
    store.dispatch(loggedOut());
    queryClient.clear();
  },
});

// Boshqa tab sessiya so'rasa — beramiz; u yerda «Chiqish» bosilsa — bu tab ham chiqadi.
const stopListeningToPeers = listenToPeers({
  getSession: () => {
    const { accessToken, cookieSession, impersonation, sessionExpired: expired } = store.getState().auth;
    // «Nomidan kirish» token'i ulashilmaydi: yangi tab admin refresh cookie'si bilan o'zi tiklanadi.
    if (impersonation || expired || (!accessToken && !cookieSession)) return null;
    return { accessToken: cookieSession ? null : accessToken };
  },
  onPeerLogout: () => {
    const { accessToken, cookieSession, sessionExpired: expired } = store.getState().auth;
    if (!accessToken && !cookieSession && !expired) return;
    store.dispatch(loggedOut({ manual: true, remote: true }));
    queryClient.clear();
  },
});

/**
 * Yangi tab (FE-02 TC2): bu tabda sessiya yo'q, lekin brauzerda bor bo'lishi mumkin —
 * avval ochiq tablardan so'raymiz, bo'lmasa refresh cookie bilan jim tiklaymiz.
 * Bo'lmasa login sahifasi odatdagidek ochiladi.
 */
async function restoreSessionInNewTab(): Promise<void> {
  const { accessToken, cookieSession, impersonation } = store.getState().auth;
  if (accessToken || cookieSession || impersonation || !sessionHint.has()) return;
  const shared = await requestSessionFromPeers();
  if (shared) {
    store.dispatch(authenticated(shared));
    return;
  }
  try {
    const refreshed = await withRefreshLock(() => refreshAccessToken());
    store.dispatch(authenticated(refreshed));
  } catch {
    sessionHint.clear();
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ejectHttpInterceptors();
    stopListeningToPeers();
  });
}

/**
 * Dev rejimida backendsiz ishlash (FE-02): MSW service worker birinchi so'rovdan oldin
 * turishi kerak. `import.meta.env.DEV` production build'da `false` — mock kodi bundle'ga
 * kirmaydi. Worker ishga tushmasa (masalan, e2e uni bloklaydi) ilova odatdagidek ishlaydi.
 */
async function startMockApiIfEnabled(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.VITE_API_MOCKS !== 'true') return;
  try {
    const { startMockApi } = await import('./mocks/browser');
    await startMockApi();
  } catch (error) {
    console.warn('[mock] MSW ishga tushmadi, so‘rovlar serverga ketadi:', error);
  }
}

async function bootstrap(): Promise<void> {
  await startMockApiIfEnabled();
  await restoreSessionInNewTab();

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
}

void bootstrap();
