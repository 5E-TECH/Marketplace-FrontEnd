import {
  Bell as BellOutlined,
  Globe2 as GlobalOutlined,
  LogOut as LogoutOutlined,
  PanelLeftClose as MenuFoldOutlined,
  PanelLeftOpen as MenuUnfoldOutlined,
  Search as SearchOutlined,
} from 'lucide-react';
import { Avatar, Badge, Button, Divider, Flex, Input, Layout, Typography } from 'antd';
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

        <Flex className={styles.headerActions} align="center">
          <Button
            type="text"
            className={styles.headerIconButton}
            icon={<GlobalOutlined />}
            aria-label="Tilni tanlash"
          />
          <Badge dot offset={[-7, 7]}>
            <Button
              type="text"
              className={styles.headerIconButton}
              icon={<BellOutlined />}
              aria-label="Bildirishnomalar"
            />
          </Badge>
          <Divider type="vertical" className={styles.headerDivider} />
          <button
            className={styles.accountSummary}
            type="button"
            aria-label="Akkaunt profiliga o‘tish"
            onClick={() => onNavigate('/profile')}
          >
            <Avatar className={styles.accountAvatar} size={34} src={user?.avatarUrl}>
              {user?.name?.slice(0, 2).toUpperCase() ?? 'AK'}
            </Avatar>
            <span className={styles.accountText}>
              <Typography.Text>{user?.name ?? 'Akkaunt'}</Typography.Text>
              <Typography.Text>{user?.role ?? 'SELLER'}</Typography.Text>
            </span>
          </button>
          <Button
            type="text"
            className={styles.logoutButton}
            icon={<LogoutOutlined />}
            aria-label="Tizimdan chiqish"
            onClick={onLogout}
          />
        </Flex>
      </Flex>
    </Layout.Header>
  );
}
