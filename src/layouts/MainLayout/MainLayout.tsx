import { App, Drawer, Grid, Layout } from 'antd';
import { Suspense, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { useLogoutMutation } from '../../features/auth/api/useLogoutMutation';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { AppBreadcrumb } from './AppBreadcrumb';
import { AppHeader } from './AppHeader';
import { AppNavigation } from './AppNavigation';
import { AppSidebar } from './AppSidebar';
import styles from './MainLayout.module.css';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { prefetchRoute } from '../../app/router/routePreload';

export default function MainLayout() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
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
      <Layout className={styles.layout}>
        {showSidebar ? (
          <AppSidebar collapsed={collapsed} />
        ) : null}
        <Drawer
          placement="left"
          width={288}
          open={!showSidebar && mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          styles={{ body: { padding: 0, background: '#0E1424' } }}
          closable={false}
        >
          <AppNavigation
            onNavigate={() => setMobileMenuOpen(false)}
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
            onNavigate={(path) => {
              prefetchRoute(path);
              void navigate(path);
            }}
          />
          <Layout.Content className={styles.content}>
            <AppBreadcrumb />
            <Suspense fallback={<PageLoader compact />}>
              <Outlet />
            </Suspense>
          </Layout.Content>
        </Layout>
      </Layout>
  );
}
