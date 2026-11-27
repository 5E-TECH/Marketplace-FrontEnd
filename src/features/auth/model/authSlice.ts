import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AccountLock } from '../lib/accountLock';
import { authStorage } from '../lib/authStorage';
import type { AuthUser, ImpersonationEndReason, ImpersonationGrant, ImpersonationSession, LoginResponse, UserRole } from './authTypes';

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
  /**
   * Foydalanuvchi o'zi «Chiqish» bosdi: login sahifasi oldingi sahifani eslab
   * qolmaydi — keyingi kirgan (boshqa) odam o'z bosh sahifasiga tushadi.
   * Sessiya muddati tugaganda `false`: o'sha foydalanuvchi o'z sahifasiga qaytadi.
   */
  manualLogout: boolean;
  /**
   * Sessiya tugadi (refresh ham 401), lekin foydalanuvchi ma'lum: sahifa yopilmaydi,
   * ustida qayta kirish oynasi chiqadi — kiritilgan ish yo'qolmaydi (umumiy-sessiya §1–2).
   */
  sessionExpired: boolean;
  /**
   * Hisob yopildi (FE-15, umumiy-sessiya 6–8): admin blokladi yoki nazoratchi nofaol qildi. Tokenlar o'chgan;
   * sahifa ochiq bo'lsa ustida «Hisobingiz bloklandi» oynasi, aks holda karkassiz sahifa.
   */
  accountLock: AccountLock | null;
  /** Shu odamning roli o'zgardi (umumiy-sessiya 9): «Rolingiz o‘zgardi» sahifasi, «Ish joyini ochish» gacha. */
  roleChange: { before: UserRole | null; after: UserRole } | null;
  /**
   * Bu tabda oxirgi ko'rilgan hisob (`role: null` — noma'lum rol): qayta kirgach roli boshqa bo'lsa — rol o'zgargan.
   * Sessiya tugaganda saqlanadi (backend rol o'zgarganda sessiyalarni bekor qiladi), qo'lda chiqishda o'chadi.
   */
  knownAccount: { id: string; role: UserRole | null } | null;
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
  manualLogout: false,
  sessionExpired: false,
  accountLock: null,
  roleChange: null,
  knownAccount: null,
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
      state.manualLogout = false;
      state.sessionExpired = false;
      state.accountLock = null;
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
      const { id, role } = action.payload;
      const known = state.knownAccount;
      if (known?.id === id && known.role !== role) state.roleChange = { before: known.role, after: role };
      state.knownAccount = { id, role };
      state.user = action.payload;
    },
    /** Backend frontend bilmagan rol qaytardi (UnknownRoleShell): keyin rol berilsa — «Oldin: Noma’lum rol». */
    unknownRoleSeen(state, action: PayloadAction<string | null>) {
      if (action.payload) state.knownAccount = { id: action.payload, role: null };
    },
    roleChangeSeen(state) {
      state.roleChange = null;
    },
    /** `remote` — boshqa tabda chiqildi; bu tab xabarni qayta tarqatmaydi. */
    loggedOut(state, action: PayloadAction<{ manual?: boolean; remote?: boolean } | undefined>) {
      state.manualLogout = action.payload?.manual === true;
      state.sessionExpired = false;
      state.accountLock = null;
      state.roleChange = null;
      if (state.manualLogout) state.knownAccount = null;
      state.sessionVersion += 1;
      state.accessToken = null;
      state.cookieSession = false;
      state.user = null;
      state.impersonation = null;
      state.impersonationEnd = null;
    },
    /** Refresh ham rad etildi: tokenlar o'chadi, foydalanuvchi va sahifa joyida qoladi. */
    sessionExpired(state) {
      if (!state.user) return;
      state.sessionVersion += 1;
      state.accessToken = null;
      state.cookieSession = false;
      state.sessionExpired = true;
    },
    /**
     * Hisob yopildi: tokenlar o'chadi, foydalanuvchi joyida — sahifa ustida oyna (u bo'lmasa — karkassiz sahifa).
     * Ochiq «Sessiya tugadi» oynasi o'rniga chiqadi.
     */
    accountLocked(state, action: PayloadAction<AccountLock>) {
      state.sessionVersion += 1;
      state.accessToken = null;
      state.cookieSession = false;
      state.sessionExpired = false;
      state.accountLock = action.payload;
    },
    /** Oynada o'sha foydalanuvchi qayta kirdi — sahifa qayta yuklanmaydi. */
    sessionRestored(state, action: PayloadAction<LoginResponse>) {
      state.sessionVersion += 1;
      state.accessToken = action.payload.accessToken;
      state.cookieSession = action.payload.accessToken === null;
      state.sessionExpired = false;
      state.manualLogout = false;
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
    selectManualLogout: (state) => state.manualLogout,
    selectSessionExpired: (state) => state.sessionExpired,
    selectAccountLock: (state) => state.accountLock,
    selectRoleChange: (state) => state.roleChange,
  },
});

export const {
  accessTokenRefreshed,
  accountLocked,
  authenticated,
  currentUserLoaded,
  impersonationEndHandled,
  impersonationEnded,
  impersonationStarted,
  loggedOut,
  roleChangeSeen,
  sessionExpired,
  sessionRestored,
  unknownRoleSeen,
} = authSlice.actions;
export const {
  selectAccountLock,
  selectAuthUser,
  selectImpersonation,
  selectImpersonationEnd,
  selectIsAuthenticated,
  selectManualLogout,
  selectRoleChange,
  selectSessionExpired,
} = authSlice.selectors;
export const authReducer = authSlice.reducer;
