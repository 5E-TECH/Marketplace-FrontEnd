import { Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { prefetchRoute } from '../../app/router/routePreload';
import { getAdminNavigation } from '../../features/adminDashboard/model/adminNavigation';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { useTranslation } from '../../shared/i18n/useTranslation';

interface AdminNavigationProps {
  onNavigate?: () => void;
}

export function AdminNavigation({ onNavigate }: AdminNavigationProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const role = useAppSelector(selectAuthUser)?.role;
  const navigation = getAdminNavigation(role);
  const selected = navigation.find(({ items }) =>
    items.some(({ path }) => pathname === path || pathname.startsWith(`${path}/`)),
  );

  return (
    <div className="app-navigation-shell admin-navigation-shell">
      <Menu
        mode="inline"
        className="app-navigation admin-navigation"
        selectedKeys={selected ? [selected.items[0].path] : []}
        items={navigation.map((group) => ({
          key: group.items[0].path,
          label: t(group.label),
          icon: group.icon,
        }))}
        onClick={({ key }) => {
          prefetchRoute(key);
          void navigate(key);
          onNavigate?.();
        }}
      />
    </div>
  );
}
