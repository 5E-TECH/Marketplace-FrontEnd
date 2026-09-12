import { Layout, Typography } from 'antd';
import { AdminNavigation } from './AdminNavigation';
import styles from '../MainLayout/MainLayout.module.css';

interface AdminSidebarProps {
  collapsed: boolean;
}

export function AdminSidebar({ collapsed }: AdminSidebarProps) {
  return (
    <Layout.Sider
      width={264}
      collapsedWidth={76}
      collapsed={collapsed}
      trigger={null}
      theme="dark"
      className={styles.sider}
      aria-label="Admin menyusi"
    >
      <div className={styles.sidebarBrand}>
        <span className={styles.sidebarLogo}>MH</span>
        <span className={styles.sidebarBrandText}>
          <Typography.Text strong>MarketHub</Typography.Text>
          <Typography.Text>ADMIN CONSOLE</Typography.Text>
        </span>
      </div>
      <AdminNavigation />
    </Layout.Sider>
  );
}
