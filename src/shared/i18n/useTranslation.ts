import { useAppSelector } from '../../app/store/hooks';
import { selectLanguage } from '../../features/preferences/model/preferencesSlice';
import { translations, type TranslationKey } from './translations';

export function useTranslation() {
  const language = useAppSelector(selectLanguage);
  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    const template = translations[language][key] ?? translations.uz[key];
    if (!params) return template;
    let result: string = template;
    for (const [name, value] of Object.entries(params)) {
      result = result.replaceAll(`{${name}}`, String(value));
    }
    return result;
  }, [language]);
  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
  return { language, locale, t };
}
import { useCallback } from 'react';
