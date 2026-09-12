import {
  BellRing as NotificationOutlined,
  LogOut as LogoutOutlined,
  PanelLeftClose as MenuFoldOutlined,
  PanelLeftOpen as MenuUnfoldOutlined,
  Search as SearchOutlined,
} from 'lucide-react';
import { Avatar, Badge, Button, Divider, Flex, Input, Layout, Typography } from 'antd';
import { useState } from 'react';
import type { AuthUser } from '../../features/auth/model/authTypes';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher/LanguageSwitcher';
import styles from './MainLayout.module.css';

interface AppHeaderProps {
  collapsed: boolean;
  mobile: boolean;
  user: AuthUser | null;
  onMenuToggle: () => void;
  onLogout: () => void;
  onNavigate: (path: string) => void;
  onGlobalSearch: (query: string) => void;
}

export function AppHeader({
  collapsed,
  mobile,
  user,
  onMenuToggle,
  onLogout,
  onNavigate,
  onGlobalSearch,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  return (
    <Layout.Header className={styles.header}>
      <Flex align="center" justify="space-between" className={styles.headerContent}>
        <Flex align="center" gap={16}>
          <Button
            type="text"
            icon={mobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            aria-label={mobile || collapsed ? t('header.openMenu') : t('header.closeMenu')}
            onClick={onMenuToggle}
          />
          {user?.role !== 'BUYER' ? <Input.Search
            className={styles.globalSearch}
            prefix={<SearchOutlined />}
            placeholder={t('header.search')}
            aria-label={t('header.globalSearch')}
            value={searchQuery}
            enterButton
            onChange={(event) => setSearchQuery(event.target.value)}
            onSearch={(value) => {
              const normalizedQuery = value.trim();
              if (normalizedQuery) onGlobalSearch(normalizedQuery);
            }}
          /> : null}
        </Flex>

        <Flex className={styles.headerActions} align="center">
          <span className={styles.languageButton}><LanguageSwitcher /></span>
          <Badge className={styles.notificationBadge} offset={[-7, 7]}>
            <Button
              type="text"
              className={styles.notificationButton}
              icon={<NotificationOutlined />}
              disabled
              title="Bildirishnomalar hali mavjud emas"
              aria-label={t('header.notifications')}
            />
          </Badge>
          <Divider type="vertical" className={styles.headerDivider} />
          <button
            className={styles.accountSummary}
            type="button"
            aria-label={t('header.profile')}
            onClick={() => onNavigate('/profile')}
          >
            <Avatar className={styles.accountAvatar} size={34} src={user?.avatarUrl}>
              {user?.name?.slice(0, 2).toUpperCase() ?? 'AK'}
            </Avatar>
            <span className={styles.accountText}>
              <Typography.Text>{user?.name ?? t('header.account')}</Typography.Text>
              <Typography.Text>{user?.role ?? 'SELLER'}</Typography.Text>
            </span>
          </button>
          <Button
            type="text"
            className={styles.logoutButton}
            icon={<LogoutOutlined />}
            aria-label={t('header.logout')}
            onClick={onLogout}
          />
        </Flex>
      </Flex>
    </Layout.Header>
  );
}
