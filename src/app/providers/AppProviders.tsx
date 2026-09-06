import { App as AntdApp, ConfigProvider } from 'antd';
import { useEffect, type PropsWithChildren } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../shared/api/queryClient';
import { appTheme } from '../../shared/config/theme';
import { store } from '../store/store';
import enUS from 'antd/locale/en_US';
import ruRU from 'antd/locale/ru_RU';
import uzUZ from 'antd/locale/uz_UZ';
import { useAppSelector } from '../store/hooks';
import { selectLanguage } from '../../features/preferences/model/preferencesSlice';

function LocalizedProviders({ children }: PropsWithChildren) {
  const language = useAppSelector(selectLanguage);
  const locale = language === 'ru' ? ruRU : language === 'en' ? enUS : uzUZ;

  useEffect(() => {
    document.documentElement.lang = language === 'uz' ? 'uz-Latn' : language;
  }, [language]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={appTheme} locale={locale}>
        <AntdApp
          message={{ duration: 3.5, maxCount: 3 }}
          notification={{ duration: 3.5, placement: 'topRight', maxCount: 3 }}
        >
          {children}
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ReduxProvider store={store}>
      <LocalizedProviders>{children}</LocalizedProviders>
    </ReduxProvider>
  );
}
