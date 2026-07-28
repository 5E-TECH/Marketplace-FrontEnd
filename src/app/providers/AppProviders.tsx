import { App as AntdApp, ConfigProvider } from 'antd';
import type { PropsWithChildren } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../shared/api/queryClient';
import { appTheme } from '../../shared/config/theme';
import { store } from '../store/store';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={appTheme}>
          <AntdApp
            message={{ duration: 3.5, maxCount: 3 }}
            notification={{ duration: 3.5, placement: 'topRight', maxCount: 3 }}
          >
            {children}
          </AntdApp>
        </ConfigProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}
