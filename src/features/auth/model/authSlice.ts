import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authStorage } from '../lib/authStorage';
import type { AuthUser, LoginResponse } from './authTypes';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
}

const persistedAccessToken = authStorage.getAccessToken();

const initialState: AuthState = {
  accessToken: persistedAccessToken,
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authenticated(state, action: PayloadAction<LoginResponse>) {
      state.accessToken = action.payload.accessToken;
      state.user = null;
    },
    currentUserLoaded(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
    },
    loggedOut(state) {
      state.accessToken = null;
      state.user = null;
    },
  },
  selectors: {
    selectAccessToken: (state) => state.accessToken,
    selectIsAuthenticated: (state) => Boolean(state.accessToken),
    selectAuthUser: (state) => state.user,
  },
});

export const { authenticated, currentUserLoaded, loggedOut } = authSlice.actions;
export const { selectAccessToken, selectAuthUser, selectIsAuthenticated } =
  authSlice.selectors;
export const authReducer = authSlice.reducer;
