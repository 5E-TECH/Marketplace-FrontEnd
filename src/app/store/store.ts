import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { authStorage } from '../../features/auth/lib/authStorage';
import {
  authenticated,
  authReducer,
  loggedOut,
} from '../../features/auth/model/authSlice';
import { preferencesReducer } from '../../features/preferences/model/preferencesSlice';

const authPersistence = createListenerMiddleware();

authPersistence.startListening({
  actionCreator: authenticated,
  effect: ({ payload }, { dispatch }) => {
    try {
      authStorage.setAccessToken(payload.accessToken);
    } catch {
      dispatch(loggedOut());
    }
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
