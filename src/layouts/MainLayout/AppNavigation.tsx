import {
  AppstoreOutlined,
  BarChartOutlined,
  ShopOutlined,
  HomeOutlined,
  SettingOutlined,
  ProfileOutlined,
  CustomerServiceOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';

const navigationItems = [
  { key: '/', icon: <BarChartOutlined />, label: 'Bosh sahifa' },
  { key: '/shop', icon: <ShopOutlined />, label: 'Do‘kon profili' },
  { key: '/products', icon: <AppstoreOutlined />, label: 'Mahsulotlar' },
  { key: '/warehouses', icon: <HomeOutlined />, label: 'Sklad' },
  { key: '/orders', icon: <ProfileOutlined />, label: 'Buyurtmalar' },
];

const utilityItems = [
  { key: '/settings', icon: <SettingOutlined />, label: 'Sozlamalar' },
  { key: '/support', icon: <CustomerServiceOutlined />, label: 'Yordam' },
  { key: 'logout', icon: <LogoutOutlined />, label: 'Chiqish', danger: true },
];

interface AppNavigationProps {
  onNavigate?: () => void;
  onLogout?: () => void;
}

export function AppNavigation({ onNavigate, onLogout }: AppNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();

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
      selectedKeys={[
        navigationItems.find(
          ({ key }) => key === '/' ? location.pathname === '/' : location.pathname.startsWith(key),
        )?.key ?? '/',
      ]}
      items={navigationItems}
      onClick={({ key }) => handleClick(key)}
    />
      <Menu
        mode="inline"
        className="app-navigation app-navigation-utility"
        selectedKeys={[location.pathname.startsWith('/settings') ? '/settings' : location.pathname.startsWith('/support') ? '/support' : '']}
        items={utilityItems}
        onClick={({ key }) => handleClick(key)}
      />
    </div>
  );
}
