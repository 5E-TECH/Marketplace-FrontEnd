import { useAppSelector } from '../../app/store/hooks';
import { selectLanguage } from '../../features/preferences/model/preferencesSlice';
import { translations, type TranslationKey } from './translations';

export function useTranslation() {
  const language = useAppSelector(selectLanguage);
  const t = (key: TranslationKey): string => translations[language][key] ?? translations.uz[key];
  return { language, t };
}
