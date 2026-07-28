import { Layout, Typography } from 'antd';
import { AppNavigation } from './AppNavigation';
import styles from './MainLayout.module.css';

interface AppSidebarProps {
  collapsed: boolean;
  onLogout: () => void;
}

export function AppSidebar({ collapsed, onLogout }: AppSidebarProps) {
  return (
    <Layout.Sider
      width={272}
      collapsedWidth={88}
      collapsed={collapsed}
      trigger={null}
      theme="dark"
      className={styles.sider}
    >
      <div className={styles.sidebarBrand}>
        <span className={styles.sidebarLogo}>MH</span>
        <span className={styles.sidebarBrandText}>
          <Typography.Text strong>MarketHub</Typography.Text>
          <Typography.Text>SELLER SPACE</Typography.Text>
        </span>
      </div>
      <AppNavigation onLogout={onLogout} />
    </Layout.Sider>
  );
}
