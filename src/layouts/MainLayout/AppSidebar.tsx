import { Layout, Typography } from 'antd';
import { AppNavigation } from './AppNavigation';
import styles from './MainLayout.module.css';

interface AppSidebarProps {
  collapsed: boolean;
}

export function AppSidebar({ collapsed }: AppSidebarProps) {
  return (
    <Layout.Sider
      width={288}
      collapsedWidth={84}
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
      <AppNavigation />
    </Layout.Sider>
  );
}
