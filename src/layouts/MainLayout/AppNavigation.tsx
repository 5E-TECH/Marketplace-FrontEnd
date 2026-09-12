import { Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  appRouteConfig,
  findRouteMeta,
} from '../../app/router/appRouteConfig';
import { prefetchRoute } from '../../app/router/routePreload';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';

interface AppNavigationProps {
  onNavigate?: () => void;
}

export function AppNavigation({ onNavigate }: AppNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAppSelector(selectAuthUser);
  const selectedRoute = findRouteMeta(location.pathname);
  // Rolga ochiq bo'lmagan bo'lim menyuda ko'rinmaydi — operator uni bosib
  // backend'dan 403 olishi kerak emas.
  const toMenuItems = (section: 'main' | 'utility') =>
    appRouteConfig
      .filter(
        (route) => route.section === section && route.showInSidebar !== false
          && (user ? route.roles.includes(user.role) : false)
          && (route.path !== '/users' || user?.role === 'SELLER'),
      )
      .map(({ path, label, icon }) => ({
        key: path,
        label: (
          <span
            onPointerEnter={() => prefetchRoute(path)}
            onFocus={() => prefetchRoute(path)}
          >
            {t(label)}
          </span>
        ),
        icon,
      }));

  const handleClick = (key: string) => {
    prefetchRoute(key);
    void navigate(key);
    onNavigate?.();
  };

  return (
    <div className="app-navigation-shell">
      <Menu
        mode="inline"
        className="app-navigation"
        selectedKeys={
          selectedRoute?.section === 'main' ? [selectedRoute.path] : []
        }
        items={toMenuItems('main')}
        onClick={({ key }) => handleClick(key)}
      />
      <Menu
        mode="inline"
        className="app-navigation app-navigation-utility"
        selectedKeys={
          selectedRoute?.section === 'utility' ? [selectedRoute.path] : []
        }
        items={toMenuItems('utility')}
        onClick={({ key }) => handleClick(key)}
      />
    </div>
  );
}
