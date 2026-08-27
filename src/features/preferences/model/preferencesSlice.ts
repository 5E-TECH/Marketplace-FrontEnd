import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type Language = 'uz' | 'ru' | 'en';

interface PreferencesState {
  language: Language;
}

const initialState: PreferencesState = {
  language: 'uz',
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    languageChanged(state, action: PayloadAction<Language>) {
      state.language = action.payload;
    },
  },
});


export const { languageChanged } = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;
