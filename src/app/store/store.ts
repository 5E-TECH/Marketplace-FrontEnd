import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { authStorage } from '../../features/auth/lib/authStorage';
import { broadcastLogout, sessionHint } from '../../features/auth/lib/sessionSync';
import {
  accessTokenRefreshed,
  accountLocked,
  authenticated,
  authReducer,
  impersonationEnded,
  impersonationStarted,
  loggedOut,
  sessionExpired,
  sessionRestored,
} from '../../features/auth/model/authSlice';
import { preferencesReducer } from '../../features/preferences/model/preferencesSlice';
import { queryClient } from '../../shared/api/queryClient';

const authPersistence = createListenerMiddleware();

// Login va oynada qayta kirish: token shu tabning sessionStorage'ida; boshqa tablar uni
// BroadcastChannel orqali so'raydi (sessionSync).
for (const actionCreator of [authenticated, sessionRestored]) {
  authPersistence.startListening({
    actionCreator,
    effect: ({ payload }, { dispatch }) => {
      try {
        if (payload.accessToken) authStorage.setAccessToken(payload.accessToken);
        else authStorage.setCookieSession();
        sessionHint.set();
      } catch {
        dispatch(loggedOut());
      }
    },
  });
}

authPersistence.startListening({
  actionCreator: accessTokenRefreshed,
  effect: ({ payload }, { dispatch }) => {
    try {
      if (payload.accessToken) authStorage.setAccessToken(payload.accessToken);
      else authStorage.setCookieSession();
    } catch {
      dispatch(loggedOut());
    }
  },
});

// Boshqa foydalanuvchi nomidan kirilganda/qaytilganda oldingi shaxsning
// keshlangan ma'lumoti ekranda qolmasin.
authPersistence.startListening({
  actionCreator: impersonationStarted,
  effect: ({ payload }, { dispatch }) => {
    try {
      authStorage.setImpersonation(payload);
    } catch {
      dispatch(impersonationEnded('exited'));
    }
    queryClient.clear();
  },
});

authPersistence.startListening({
  actionCreator: impersonationEnded,
  effect: () => {
    authStorage.clearImpersonation();
    queryClient.clear();
  },
});

authPersistence.startListening({
  actionCreator: loggedOut,
  effect: ({ payload }) => {
    authStorage.clear();
    sessionHint.clear();
    // Qo'lda chiqish — qolgan tablar ham chiqadi (ularning tokeni hali amal qilsa ham).
    if (payload?.manual && !payload.remote) broadcastLogout();
  },
});

// Sessiya tugadi yoki hisob yopildi (FE-15): token tozalanadi, sahifa va kesh joyida (ustida oyna).
for (const actionCreator of [sessionExpired, accountLocked]) {
  authPersistence.startListening({
    actionCreator,
    effect: () => {
      authStorage.clear();
      sessionHint.clear();
    },
  });
}

export const store = configureStore({
  reducer: {
    auth: authReducer,
    preferences: preferencesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(authPersistence.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
