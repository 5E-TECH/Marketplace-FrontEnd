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
    colorBgBase: palette.backgroundContainer,
    colorBgLayout: palette.backgroundLayout,
    colorBgContainer: palette.backgroundContainer,
    borderRadius: 10,
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
    controlHeight: 40,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: palette.backgroundContainer,
      bodyBg: palette.backgroundLayout,
    },
    Button: {
      controlHeight: 44,
      borderRadius: 18,
      fontWeight: 500,
      primaryShadow: 'none',
      colorPrimaryHover: palette.primaryHover,
      colorPrimaryActive: palette.primaryActive,
    },
    Input: {
      controlHeight: 44,
      borderRadius: 16,
    },
    Select: {
      controlHeight: 44,
      borderRadius: 16,
    },
    Card: {
      borderRadiusLG: 24,
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
    Tag: {
      borderRadiusSM: 8,
    },
    Modal: {
      borderRadiusLG: 14,
    },
  },
};
