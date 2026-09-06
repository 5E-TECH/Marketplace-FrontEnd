import { theme, type ThemeConfig } from 'antd';
import { palette } from './palette';

export const appTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
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
    colorBgBase: palette.backgroundLayout,
    colorBgLayout: palette.backgroundLayout,
    colorBgContainer: palette.backgroundContainer,
    colorBgElevated: palette.backgroundContainer,
    borderRadius: 8,
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
      borderRadius: 12,
      fontWeight: 600,
      primaryShadow: 'none',
      colorPrimaryHover: palette.primaryHover,
      colorPrimaryActive: palette.primaryActive,
    },
    Input: {
      controlHeight: 44,
      borderRadius: 8,
    },
    Select: {
      controlHeight: 44,
      borderRadius: 8,
    },
    Card: {
      borderRadiusLG: 16,
      paddingLG: 24,
    },
    Table: {
      headerBg: palette.backgroundLayout,
      borderColor: palette.border,
      rowHoverBg: palette.rowHover,
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Menu: {
      itemSelectedBg: palette.primaryBackground,
      itemSelectedColor: palette.primary,
      itemBorderRadius: 8,
    },
    Tag: {
      borderRadiusSM: 8,
    },
    Modal: {
      borderRadiusLG: 16,
      contentBg: palette.backgroundContainer,
      headerBg: palette.backgroundContainer,
    },
    Drawer: {
      colorBgElevated: palette.backgroundContainer,
    },
    Popover: {
      colorBgElevated: palette.backgroundContainer,
    },
  },
};
