import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authStorage } from '../lib/authStorage';
import type { AuthUser, ImpersonationEndReason, ImpersonationGrant, ImpersonationSession, LoginResponse } from './authTypes';

interface AuthState {
  sessionVersion: number;
  accessToken: string | null;
  /** Token tanada kelmagan, sessiya HttpOnly cookie'da. */
  cookieSession: boolean;
  user: AuthUser | null;
  /** Faol "nomidan kirish" — `accessToken` shu vaqt impersonatsiya token'i. */
  impersonation: ImpersonationSession | null;
  /** Impersonatsiya tugadi: UI bir marta qaytish sahifasiga o'tadi va xabar beradi. */
  impersonationEnd: { reason: ImpersonationEndReason; returnTo: string } | null;
}

const persistedAccessToken = authStorage.getAccessToken();
const persistedCookieSession = !persistedAccessToken && authStorage.hasCookieSession();
const persistedImpersonation = persistedAccessToken || persistedCookieSession ? authStorage.getImpersonation() : null;

const initialState: AuthState = {
  sessionVersion: 0,
  accessToken: persistedImpersonation?.token ?? persistedAccessToken,
  cookieSession: persistedImpersonation ? false : persistedCookieSession,
  user: null,
  impersonation: persistedImpersonation
    ? { ...persistedImpersonation, admin: { accessToken: persistedAccessToken, cookieSession: persistedCookieSession } }
    : null,
  impersonationEnd: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authenticated(state, action: PayloadAction<LoginResponse>) {
      state.sessionVersion += 1;
      state.accessToken = action.payload.accessToken;
      state.cookieSession = action.payload.accessToken === null;
      state.user = null;
      state.impersonationEnd = null;
    },
    /**
     * Token yangilandi (refresh cookie orqali). Bu login emas — yuklangan
     * foydalanuvchi ma'lumoti saqlanib qoladi, aks holda kabinet har
     * yangilanishda "profil olinmadi" holatiga tushardi.
     */
    accessTokenRefreshed(state, action: PayloadAction<LoginResponse>) {
      // Cookie rejimida refresh token qaytarmaydi — cookie'ni server yangilaydi.
      // Backend shu rejimga o'tgan bo'lsa, eski (muddati o'tgan) token ham
      // tashlanadi, aks holda qayta yuborilgan so'rovga yana qo'shilib 401 berardi.
      state.accessToken = action.payload.accessToken;
      state.cookieSession = action.payload.accessToken === null;
    },
    currentUserLoaded(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
    },
    loggedOut(state) {
      state.sessionVersion += 1;
      state.accessToken = null;
      state.cookieSession = false;
      state.user = null;
      state.impersonation = null;
      state.impersonationEnd = null;
    },
    /** Admin sessiyasi saqlanadi; so'rovlar impersonatsiya token'i bilan ketadi. */
    impersonationStarted(state, action: PayloadAction<ImpersonationGrant & { returnTo: string }>) {
      if (state.impersonation) return;
      state.impersonation = { ...action.payload, admin: { accessToken: state.accessToken, cookieSession: state.cookieSession } };
      state.sessionVersion += 1;
      state.accessToken = action.payload.token;
      state.cookieSession = false;
      state.user = null;
      state.impersonationEnd = null;
    },
    impersonationEnded(state, action: PayloadAction<ImpersonationEndReason>) {
      if (!state.impersonation) return;
      const { admin, returnTo } = state.impersonation;
      state.sessionVersion += 1;
      state.accessToken = admin.accessToken;
      state.cookieSession = admin.cookieSession;
      state.user = null;
      state.impersonation = null;
      state.impersonationEnd = { reason: action.payload, returnTo };
    },
    impersonationEndHandled(state) {
      state.impersonationEnd = null;
    },
  },
  selectors: {
    selectIsAuthenticated: (state) => Boolean(state.accessToken) || state.cookieSession,
    selectAuthUser: (state) => state.user,
    selectImpersonation: (state) => state.impersonation,
    selectImpersonationEnd: (state) => state.impersonationEnd,
  },
});

export const {
  accessTokenRefreshed,
  authenticated,
  currentUserLoaded,
  impersonationEndHandled,
  impersonationEnded,
  impersonationStarted,
  loggedOut,
} = authSlice.actions;
export const { selectAuthUser, selectImpersonation, selectImpersonationEnd, selectIsAuthenticated } =
  authSlice.selectors;
export const authReducer = authSlice.reducer;
