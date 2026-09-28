import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { authStorage } from '../../features/auth/lib/authStorage';
import {
  accessTokenRefreshed,
  authenticated,
  authReducer,
  impersonationEnded,
  impersonationStarted,
  loggedOut,
} from '../../features/auth/model/authSlice';
import { preferencesReducer } from '../../features/preferences/model/preferencesSlice';
import { queryClient } from '../../shared/api/queryClient';

const authPersistence = createListenerMiddleware();

authPersistence.startListening({
  actionCreator: authenticated,
  effect: ({ payload }, { dispatch }) => {
    try {
      if (payload.accessToken) authStorage.setAccessToken(payload.accessToken);
      else authStorage.setCookieSession();
    } catch {
      dispatch(loggedOut());
    }
  },
});

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
  effect: () => {
    authStorage.clear();
  },
});

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
