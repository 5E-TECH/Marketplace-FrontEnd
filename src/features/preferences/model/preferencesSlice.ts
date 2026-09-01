import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Language = 'uz' | 'ru' | 'en';

const LANGUAGE_STORAGE_KEY = 'markethub_language';

function readStoredLanguage(): Language {
  try {
    const language = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return language === 'uz' || language === 'ru' || language === 'en'
      ? language
      : 'uz';
  } catch {
    return 'uz';
  }
}

interface PreferencesState {
  language: Language;
}

const initialState: PreferencesState = {
  language: readStoredLanguage(),
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    languageChanged(state, action: PayloadAction<Language>) {
      state.language = action.payload;
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, action.payload);
      } catch {
        // Storage bloklangan bo‘lsa tanlov joriy sessiyada Redux orqali ishlaydi.
      }
    },
  },
});


export const { languageChanged } = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;
export const selectLanguage = (state: { preferences: PreferencesState }) =>
  state.preferences.language;
