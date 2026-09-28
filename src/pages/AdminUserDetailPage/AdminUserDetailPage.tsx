import { Alert, App, Button, Form } from 'antd';
import {
  Ban,
  CalendarClock,
  IdCard,
  LogIn,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Store,
  Trash2,
  UserCog,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDefaultRoute } from '../../app/router/appRouteConfig';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { impersonationStarted, selectAuthUser } from '../../features/auth/model/authSlice';
import {
  useAdminUserQuery,
  useChangeAdminUserRoleMutation,
  useImpersonateAdminUserMutation,
  useSetAdminUserBlockedMutation,
} from '../../features/adminUsers/api/adminUserQueries';
import { ADMIN_USER_ROLE_OPTIONS } from '../../features/adminUsers/model/adminUserOptions';
import type { AdminUser, AssignableUserRole } from '../../features/adminUsers/model/adminUserTypes';
import {
  ADMIN_USER_BLOCK_ACTION_CONFIG,
} from '../../features/adminUsers/ui/adminUserActionConfig';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { formatDateTime } from '../../shared/lib/date';
import { useTranslation } from '../../shared/i18n/useTranslation';
import type { TranslationKey } from '../../shared/i18n/translations';
import { BackButton } from '../../shared/ui/BackButton/BackButton';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DetailPage, type DetailPageSection } from '../../shared/ui/DetailPage/DetailPage';
import { SelectControl } from '../../shared/ui/FormControls/FormControls';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
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
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const [roleForm] = Form.useForm<{ role: AssignableUserRole }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentAdmin = useAppSelector(selectAuthUser);
  const userQuery = useAdminUserQuery(userId ?? null);
  const blockMutation = useSetAdminUserBlockedMutation();
  const roleMutation = useChangeAdminUserRoleMutation();
  const impersonateMutation = useImpersonateAdminUserMutation();
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
        onError: (error) => void message.error(getApiErrorMessage(error)),
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
            description={getApiErrorMessage(userQuery.error)}
            onAction={() => void userQuery.refetch()}
          />
        ) : (
          <ContentState state="loading" />
        )}
      </main>
    );
  }

  const blockAction = ADMIN_USER_BLOCK_ACTION_CONFIG[user.blocked ? 'blocked' : 'active'];
  const isSuperAdmin = currentAdmin?.role === 'SUPERADMIN';
  const isSelf = currentAdmin?.id === user.id;
  // ADMIN xaridor/sotuvchi rollarini boshqaradi; admin jamoasi rollari — faqat SUPERADMIN.
  const canManageRole = !isSelf && !user.isDeleted && (isSuperAdmin || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'));
  const roleOptions = ADMIN_USER_ROLE_OPTIONS.filter(({ value }) =>
    value !== user.role && value !== 'OPERATOR' && (value === 'BUYER' || value === 'SELLER' || isSuperAdmin));
  const currentRoleLabel = ADMIN_USER_ROLE_OPTIONS.find(({ value }) => value === user.role)?.label;
  // Kabinet sotuvchi va operator ko'rinishini ko'rsata oladi; nomidan kirish — faqat SUPERADMIN.
  const canImpersonate = isSuperAdmin && !isSelf && !user.isDeleted && !user.blocked && (user.role === 'SELLER' || user.role === 'OPERATOR');
  const displayName = user.name || user.phone;

  const changeRole = ({ role }: { role: AssignableUserRole }) => {
    roleMutation.mutate({ id: user.id, role }, {
      onSuccess: () => {
        setRoleDialogOpen(false);
        void message.success(t('admin.users.roleChanged'));
      },
      onError: (error) => void message.error(getApiErrorMessage(error)),
    });
  };

  const startImpersonation = () => {
    if (impersonateMutation.isPending) return;
    impersonateMutation.mutate(user.id, {
      onSuccess: (grant) => {
        setImpersonateDialogOpen(false);
        dispatch(impersonationStarted({ ...grant, returnTo: `/admin/users/${encodeURIComponent(user.id)}` }));
        void navigate(getDefaultRoute(grant.user.role), { replace: true });
      },
      onError: (error) => void message.error(getApiErrorMessage(error)),
    });
  };

  return (
    <>
      <DetailPage
        backFallback="/admin/users"
        title={t('admin.users.detailTitle')}
        description={t('admin.users.userNumber', { id: user.id })}
        actions={
          <div className={styles.actions}>
            {canManageRole && roleOptions.length ? (
              <Button icon={<UserCog size={17} />} onClick={() => setRoleDialogOpen(true)}>
                {t('admin.users.changeRole')}
              </Button>
            ) : null}
            {canImpersonate ? (
              <Button icon={<LogIn size={17} />} onClick={() => setImpersonateDialogOpen(true)}>
                {t('admin.users.impersonate')}
              </Button>
            ) : null}
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
      <FormModal<{ role: AssignableUserRole }>
        open={roleDialogOpen}
        title={t('admin.users.changeRoleTitle')}
        form={roleForm}
        submitText={t('admin.users.changeRole')}
        loading={roleMutation.isPending}
        onCancel={() => setRoleDialogOpen(false)}
        onSubmit={changeRole}
      >
        <Alert
          className={styles.roleWarning}
          type="warning"
          showIcon
          title={t('admin.users.changeRoleWarning', { name: displayName, role: currentRoleLabel ? t(currentRoleLabel) : user.role })}
        />
        <Form.Item name="role" label={t('admin.users.newRole')} rules={[{ required: true, message: t('admin.users.roleRequired') }]}>
          <SelectControl options={roleOptions.map(({ value, label }) => ({ value, label: t(label) }))} />
        </Form.Item>
      </FormModal>
      <ConfirmDialog
        open={impersonateDialogOpen}
        title={t('admin.users.impersonateTitle', { name: displayName })}
        description={t('admin.users.impersonateDescription')}
        confirmText={t('admin.users.impersonate')}
        loading={impersonateMutation.isPending}
        onCancel={() => setImpersonateDialogOpen(false)}
        onConfirm={startImpersonation}
      />
    </>
  );
}
