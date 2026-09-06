import {
  BellRing as NotificationOutlined,
  ChevronDown,
  Languages as LanguageOutlined,
  LogOut as LogoutOutlined,
  PanelLeftClose as MenuFoldOutlined,
  PanelLeftOpen as MenuUnfoldOutlined,
  Search as SearchOutlined,
} from 'lucide-react';
import { Avatar, Badge, Button, Divider, Dropdown, Flex, Input, Layout, Typography } from 'antd';
import { useState } from 'react';
import type { AuthUser } from '../../features/auth/model/authTypes';
import { useAppDispatch } from '../../app/store/hooks';
import { languageChanged, type Language } from '../../features/preferences/model/preferencesSlice';
import { useTranslation } from '../../shared/i18n/useTranslation';
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
  const dispatch = useAppDispatch();
  const { language, t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const languages: Array<{ key: Language; label: string }> = [
    { key: 'uz', label: "O‘zbekcha" },
    { key: 'ru', label: 'Русский' },
    { key: 'en', label: 'English' },
  ];
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
          <Input.Search
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
          />
        </Flex>

        <Flex className={styles.headerActions} align="center">
          <Dropdown
            trigger={['click']}
            menu={{
              selectable: true,
              selectedKeys: [language],
              items: languages,
              onClick: ({ key }) => dispatch(languageChanged(key as Language)),
            }}
          >
            <Button type="text" className={styles.languageButton} aria-label={t('header.selectLanguage')}>
              <LanguageOutlined />
              <span>{language.toUpperCase()}</span>
              <ChevronDown className={styles.languageChevron} />
            </Button>
          </Dropdown>
          <Badge dot className={styles.notificationBadge} offset={[-7, 7]}>
            <Button
              type="text"
              className={styles.notificationButton}
              icon={<NotificationOutlined />}
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
