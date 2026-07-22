import { Layout, Space, Typography, theme } from 'antd';
import { Link, Outlet } from 'react-router-dom';
import styles from './MainLayout.module.css';

const { Header, Content, Footer } = Layout;

export default function MainLayout() {
  const { token } = theme.useToken();

  return (
    <Layout className={styles.layout}>
      <Header className={styles.header}>
        <Space className={styles.headerContent}>
          <Link to="/" aria-label="Marketplace bosh sahifasi">
            <Typography.Title level={4} className={styles.logo}>
              Marketplace
            </Typography.Title>
          </Link>
        </Space>
      </Header>

      <Content className={styles.content}>
        <Outlet />
      </Content>

      <Footer className={styles.footer}>
        <Typography.Text type="secondary">
          © {new Date().getFullYear()} Marketplace
        </Typography.Text>
      </Footer>

      <style>{`:root { --app-content-max-width: ${token.screenXL}px; }`}</style>
    </Layout>
  );
}
