import type { Language } from '../../../features/preferences/model/preferencesSlice';

export const LANGUAGE_OPTIONS: ReadonlyArray<{ key: Language; label: string }> = [
  { key: 'uz', label: 'O‘zbekcha' },
  { key: 'ru', label: 'Русский' },
  { key: 'en', label: 'English' },
];
