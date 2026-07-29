import { App, ConfigProvider, Drawer, Grid, Layout, theme as antdTheme } from 'antd';
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { useLogoutMutation } from '../../features/auth/api/useLogoutMutation';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { SellerAccessGuard } from '../../features/auth/ui/SellerAccessGuard/SellerAccessGuard';
import { AppHeader } from './AppHeader';
import { AppNavigation } from './AppNavigation';
import { ApprovalBanner } from './ApprovalBanner';
import { AppSidebar } from './AppSidebar';
import styles from './MainLayout.module.css';

export default function MainLayout() {
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);
  const logoutMutation = useLogoutMutation();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showSidebar = Boolean(screens.md);
  const tablet = showSidebar && !screens.lg;
  const collapsed = tablet ? !tabletExpanded : desktopCollapsed;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onError: () =>
        void message.warning(
          'Server sessiyasi yopilmadi, lokal sessiya tozalandi',
        ),
    });
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: '#FB923C',
          colorInfo: '#FB923C',
          colorSuccess: '#2DD4BF',
          colorWarning: '#FBBF24',
          colorError: '#FB7185',
          colorBgBase: '#080D18',
          colorBgLayout: '#080D18',
          colorBgContainer: '#151C2F',
          colorBorder: '#27314A',
          colorTextBase: '#F8FAFC',
          borderRadius: 14,
        },
      }}
    >
      <Layout className={styles.layout}>
      {showSidebar ? (
        <AppSidebar collapsed={collapsed} onLogout={handleLogout} />
      ) : null}
      <Drawer
        placement="left"
        width={272}
        open={!showSidebar && mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        styles={{
          body: {
            padding: 0,
            background: '#0E1424',
          },
        }}
        closable={false}
      >
        <AppNavigation
          onNavigate={() => setMobileMenuOpen(false)}
          onLogout={handleLogout}
        />
      </Drawer>

      <Layout className={styles.main}>
        <AppHeader
          collapsed={collapsed}
          mobile={!showSidebar}
          user={user}
          onMenuToggle={() =>
            showSidebar
              ? tablet
                ? setTabletExpanded((value) => !value)
                : setDesktopCollapsed((value) => !value)
              : setMobileMenuOpen(true)
          }
          onLogout={handleLogout}
          onNavigate={(path) => void navigate(path)}
        />
        <ApprovalBanner pending={user?.role === 'SELLER' && !user.isActive} />
        <Layout.Content className={styles.content}>
          <SellerAccessGuard>
            <Outlet />
          </SellerAccessGuard>
        </Layout.Content>
      </Layout>
      </Layout>
    </ConfigProvider>
  );
}
