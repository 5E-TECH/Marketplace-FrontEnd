import { Layout, Typography } from 'antd';
import { AppNavigation } from './AppNavigation';
import styles from './MainLayout.module.css';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';

interface AppSidebarProps {
  collapsed: boolean;
}

export function AppSidebar({ collapsed }: AppSidebarProps) {
  const role = useAppSelector(selectAuthUser)?.role;
  return (
    <Layout.Sider
      width={264}
      collapsedWidth={76}
      collapsed={collapsed}
      trigger={null}
      theme="dark"
      className={styles.sider}
    >
      <div className={styles.sidebarBrand}>
        <span className={styles.sidebarLogo}>MH</span>
        <span className={styles.sidebarBrandText}>
          <Typography.Text strong>MarketHub</Typography.Text>
          <Typography.Text>{role === 'ADMIN' || role === 'SUPERADMIN' ? 'ADMIN CONSOLE' : 'SELLER SPACE'}</Typography.Text>
        </span>
      </div>
      <AppNavigation />
    </Layout.Sider>
  );
}
