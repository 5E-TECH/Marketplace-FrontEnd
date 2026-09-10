import { App, Button } from 'antd';
import {
  Ban,
  CalendarClock,
  IdCard,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useAdminUserQuery,
  useSetAdminUserBlockedMutation,
} from '../../features/adminUsers/api/adminUserQueries';
import type { AdminUser } from '../../features/adminUsers/model/adminUserTypes';
import {
  ADMIN_USER_BLOCK_ACTION_CONFIG,
} from '../../features/adminUsers/ui/adminUserActionConfig';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime } from '../../shared/lib/date';
import { useTranslation } from '../../shared/i18n/useTranslation';
import type { TranslationKey } from '../../shared/i18n/translations';
import { BackButton } from '../../shared/ui/BackButton/BackButton';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DetailPage, type DetailPageSection } from '../../shared/ui/DetailPage/DetailPage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import styles from './AdminUserDetailPage.module.css';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

function getDetailSections(user: AdminUser, locale: string, t: Translate): DetailPageSection[] {
  return [
    {
      key: 'personal',
      icon: <UserRound aria-hidden />,
      title: t('admin.users.personal'),
      description: t('admin.users.personalDescription'),
      fields: [
        { key: 'name', icon: <UserRound />, label: t('admin.users.fullName'), value: user.name || '—' },
        { key: 'phone', icon: <Phone />, label: t('admin.users.phone'), value: user.phone || '—' },
        { key: 'email', icon: <Mail />, label: t('admin.users.email'), value: user.email || '—' },
        { key: 'role', icon: <IdCard />, label: t('admin.users.role'), value: user.role },
      ],
    },
    {
      key: 'account',
      icon: <ShieldCheck aria-hidden />,
      title: t('admin.users.accountStatus'),
      description: t('admin.users.accountStatusDescription'),
      fields: [
        { key: 'id', icon: <IdCard />, label: t('admin.users.userId'), value: `#${user.id}` },
        {
          key: 'shop',
          icon: <Store />,
          label: t('admin.users.shopId'),
          value: user.shopId ? `#${user.shopId}` : t('admin.users.notAssigned'),
        },
        {
          key: 'active',
          icon: <ShieldCheck />,
          label: t('admin.users.activity'),
          value: <StatusTag status={user.isActive ? 'ACTIVE' : 'INACTIVE'} />,
        },
        {
          key: 'blocked',
          icon: <Ban />,
          label: t('admin.users.blockStatus'),
          value: <StatusTag status={user.blocked ? 'BLOCKED' : 'ACTIVE'} />,
        },
        {
          key: 'deleted',
          icon: <Trash2 />,
          label: t('admin.users.deletedField'),
          value: user.isDeleted ? t('common.yes') : t('common.no'),
        },
      ],
    },
    {
      key: 'dates',
      icon: <CalendarClock aria-hidden />,
      title: t('admin.users.timeInfo'),
      description: t('admin.users.timeInfoDescription'),
      fields: [
        {
          key: 'createdAt',
          icon: <CalendarClock />,
          label: t('admin.users.registeredAt'),
          value: user.createdAt ? formatDateTime(user.createdAt, locale) : '—',
        },
        {
          key: 'updatedAt',
          icon: <CalendarClock />,
          label: t('common.updatedAt'),
          value: user.updatedAt ? formatDateTime(user.updatedAt, locale) : '—',
        },
      ],
    },
  ];
}

export default function AdminUserDetailPage() {
  const { message } = App.useApp();
  const { locale, t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const userQuery = useAdminUserQuery(userId ?? null);
  const blockMutation = useSetAdminUserBlockedMutation();
  const user = userQuery.data;

  const toggleBlocked = () => {
    if (!user || blockMutation.isPending) return;
    blockMutation.mutate(
      { id: user.id, blocked: !user.blocked },
      {
        onSuccess: () => {
          setBlockDialogOpen(false);
          void message.success(
            user.blocked ? t('admin.users.unblocked') : t('admin.users.blocked'),
          );
        },
        onError: (error) => void message.error(getAuthErrorMessage(error)),
      },
    );
  };

  if (!userId || userQuery.isPending || userQuery.isError || !user) {
    return (
      <main className={styles.statePage}>
        <PageHeader
          before={<BackButton fallback="/admin/users" />}
          title={t('admin.users.detailTitle')}
          description={userId ? t('admin.users.userNumber', { id: userId }) : t('admin.users.userInfo')}
        />
        {!userId ? (
          <ContentState
            state="error"
            title={t('admin.users.notIdentified')}
            description={t('admin.users.notIdentifiedDescription')}
          />
        ) : userQuery.isError ? (
          <ContentState
            state="error"
            title={t('admin.users.detailLoadError')}
            description={getAuthErrorMessage(userQuery.error)}
            onAction={() => void userQuery.refetch()}
          />
        ) : (
          <ContentState state="loading" />
        )}
      </main>
    );
  }

  const blockAction = ADMIN_USER_BLOCK_ACTION_CONFIG[user.blocked ? 'blocked' : 'active'];

  return (
    <>
      <DetailPage
        backFallback="/admin/users"
        title={t('admin.users.detailTitle')}
        description={t('admin.users.userNumber', { id: user.id })}
        actions={
          <div className={styles.actions}>
            <Button
              icon={<Pencil size={17} />}
              onClick={() => void message.warning(t('admin.users.writeUnavailable'))}
            >
              {t('common.edit')}
            </Button>
            <Button
              danger={blockAction.danger}
              icon={<blockAction.Icon size={17} />}
              loading={blockMutation.isPending}
              onClick={() => setBlockDialogOpen(true)}
            >
              {t(blockAction.label)}
            </Button>
            <Button
              danger
              icon={<Trash2 size={17} />}
              onClick={() => void message.warning(t('admin.users.writeUnavailable'))}
            >
              {t('common.delete')}
            </Button>
          </div>
        }
        hero={{
          avatarUrl: user.avatarUrl,
          avatarFallback: (user.name || user.phone || 'U').slice(0, 2).toUpperCase(),
          title: user.name || t('admin.users.unnamed'),
          subtitle: user.email || user.phone || t('admin.users.noContact'),
          badges: (
            <>
              <StatusTag status={user.blocked ? 'BLOCKED' : user.isActive ? 'ACTIVE' : 'INACTIVE'} />
              <span className={styles.role}>{user.role}</span>
            </>
          ),
        }}
        sections={getDetailSections(user, locale, t)}
      />
      <ConfirmDialog
        open={blockDialogOpen}
        title={user.blocked
          ? t('admin.users.unblockTitle')
          : t('admin.users.blockTitle')}
        description={user.name || user.phone}
        confirmText={t(blockAction.label)}
        danger={blockAction.danger}
        loading={blockMutation.isPending}
        onCancel={() => setBlockDialogOpen(false)}
        onConfirm={toggleBlocked}
      />
    </>
  );
}
