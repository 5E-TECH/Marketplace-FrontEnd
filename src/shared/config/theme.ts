import type { ThemeConfig } from 'antd';
import { palette } from './palette';

export const appTheme: ThemeConfig = {
  cssVar: {},
  token: {
    colorPrimary: palette.primary,
    colorInfo: palette.info,
    colorSuccess: palette.success,
    colorWarning: palette.warning,
    colorError: palette.error,
    colorBgLayout: palette.backgroundLayout,
    colorBgContainer: palette.backgroundContainer,
    borderRadius: 8,
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Layout: {
      headerBg: palette.backgroundContainer,
      bodyBg: palette.backgroundLayout,
    },
    Button: {
      controlHeight: 40,
    },
  },
};
