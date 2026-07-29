import {
  BellOutlined,
  DownOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Dropdown, Flex, Input, Layout } from 'antd';
import type { AuthUser } from '../../features/auth/model/authTypes';
import styles from './MainLayout.module.css';

interface AppHeaderProps {
  collapsed: boolean;
  mobile: boolean;
  user: AuthUser | null;
  onMenuToggle: () => void;
  onLogout: () => void;
  onNavigate: (path: string) => void;
}

export function AppHeader({
  collapsed,
  mobile,
  user,
  onMenuToggle,
  onLogout,
  onNavigate,
}: AppHeaderProps) {
  return (
    <Layout.Header className={styles.header}>
      <Flex align="center" justify="space-between" className={styles.headerContent}>
        <Flex align="center" gap={16}>
          <Button
            type="text"
            icon={mobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            aria-label={mobile || collapsed ? 'Menyuni ochish' : 'Menyuni yopish'}
            onClick={onMenuToggle}
          />
          <Input
            className={styles.globalSearch}
            prefix={<SearchOutlined />}
            placeholder="Mahsulot, buyurtma yoki mijoz..."
            aria-label="Global qidiruv"
          />
        </Flex>

        <Flex align="center" gap={12}>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'new-order', label: 'Yangi buyurtma qabul qilindi' },
                { key: 'low-stock', label: '2 ta mahsulot kam qoldi' },
              ],
            }}
          >
            <Badge dot offset={[-6, 5]}>
              <Button type="text" icon={<BellOutlined />} aria-label="Bildirishnomalar" />
            </Badge>
          </Dropdown>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: 'Profil', onClick: () => onNavigate('/settings') },
                { key: 'settings', icon: <SettingOutlined />, label: 'Sozlamalar', onClick: () => onNavigate('/settings') },
                { type: 'divider' },
                { key: 'logout', danger: true, icon: <LogoutOutlined />, label: 'Chiqish', onClick: onLogout },
              ],
            }}
          >
            <Button type="text" className={styles.userButton}>
              <Avatar size={34} src={user?.avatarUrl}>{user?.name?.slice(0, 2).toUpperCase() ?? 'AK'}</Avatar>
              <DownOutlined className={styles.chevron} />
            </Button>
          </Dropdown>
        </Flex>
      </Flex>
    </Layout.Header>
  );
}
