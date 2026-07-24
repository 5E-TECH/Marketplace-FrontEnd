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
    colorTextBase: palette.textPrimary,
    colorTextSecondary: palette.textSecondary,
    colorTextDisabled: palette.textDisabled,
    colorBorder: palette.border,
    colorBgLayout: palette.backgroundLayout,
    colorBgContainer: palette.backgroundContainer,
    borderRadius: 10,
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
    controlHeight: 40,
  },
  components: {
    Layout: {
      headerBg: palette.backgroundContainer,
      bodyBg: palette.backgroundLayout,
    },
    Button: {
      controlHeight: 44,
      borderRadius: 10,
      fontWeight: 500,
      primaryShadow: 'none',
      colorPrimaryHover: palette.primaryHover,
      colorPrimaryActive: palette.primaryActive,
    },
    Input: {
      controlHeight: 44,
      borderRadius: 10,
    },
    Select: {
      controlHeight: 44,
      borderRadius: 10,
    },
    Card: {
      borderRadiusLG: 14,
      paddingLG: 24,
    },
    Table: {
      headerBg: palette.backgroundLayout,
      borderColor: palette.border,
      rowHoverBg: palette.primaryBackground,
      cellPaddingBlock: 14,
    },
    Menu: {
      itemSelectedBg: palette.primaryBackground,
      itemSelectedColor: palette.primary,
      itemBorderRadius: 10,
    },
  },
};
