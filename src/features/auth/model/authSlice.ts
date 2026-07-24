import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authStorage } from '../lib/authStorage';
import type { AuthUser, LoginResponse } from './authTypes';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
}

const initialState: AuthState = {
  accessToken: authStorage.getAccessToken(),
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authenticated(state, action: PayloadAction<LoginResponse>) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      authStorage.setAccessToken(action.payload.accessToken);
    },
    loggedOut(state) {
      state.accessToken = null;
      state.user = null;
      authStorage.clear();
    },
  },
  selectors: {
    selectAccessToken: (state) => state.accessToken,
    selectIsAuthenticated: (state) => Boolean(state.accessToken),
    selectAuthUser: (state) => state.user,
  },
});

export const { authenticated, loggedOut } = authSlice.actions;
export const { selectAccessToken, selectIsAuthenticated, selectAuthUser } =
  authSlice.selectors;
export const authReducer = authSlice.reducer;
