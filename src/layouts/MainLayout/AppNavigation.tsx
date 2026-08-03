import { LogoutOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  appRouteConfig,
  findRouteMeta,
} from '../../app/router/appRouteConfig';

interface AppNavigationProps {
  onNavigate?: () => void;
  onLogout?: () => void;
}

export function AppNavigation({ onNavigate, onLogout }: AppNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedRoute = findRouteMeta(location.pathname);
  const toMenuItems = (section: 'main' | 'utility') =>
    appRouteConfig
      .filter((route) => route.section === section)
      .map(({ path, label, icon }) => ({ key: path, label, icon }));

  const handleClick = (key: string) => {
    if (key === 'logout') {
      onLogout?.();
    } else {
      void navigate(key);
    }
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
        items={[
          ...toMenuItems('utility'),
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Chiqish',
            danger: true,
          },
        ]}
        onClick={({ key }) => handleClick(key)}
      />
    </div>
  );
}
