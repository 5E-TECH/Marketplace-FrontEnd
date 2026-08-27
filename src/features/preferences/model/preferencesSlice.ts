import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Language = 'uz' | 'ru' | 'en';

interface PreferencesState {
  language: Language;
}

const storedLanguage = (() => {
  try {
    const value = localStorage.getItem('markethub_language');
    return value === 'ru' || value === 'en' || value === 'uz' ? value : 'uz';
  } catch {
    return 'uz';
  }
})();

const initialState: PreferencesState = { language: storedLanguage };

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    languageChanged(state, action: PayloadAction<Language>) {
      state.language = action.payload;
      try {
        localStorage.setItem('markethub_language', action.payload);
      } catch {
        // Storage bloklanganida til joriy sessiyada Redux orqali ishlaydi.
      }
    },
  },
});

export const { languageChanged } = preferencesSlice.actions;
export const selectLanguage = (state: { preferences: PreferencesState }) =>
  state.preferences.language;
export const preferencesReducer = preferencesSlice.reducer;
