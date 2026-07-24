import { configureStore } from '@reduxjs/toolkit';
import { preferencesReducer } from '../../features/preferences/model/preferencesSlice';
import { authReducer } from '../../features/auth/model/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    preferences: preferencesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
