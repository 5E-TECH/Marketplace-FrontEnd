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
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAdminUserQuery,
  useSetAdminUserBlockedMutation,
} from '../../features/adminUsers/api/adminUserQueries';
import type { AdminUser } from '../../features/adminUsers/model/adminUserTypes';
import { AdminUserDeleteDialog } from '../../features/adminUsers/ui/AdminUserDeleteDialog/AdminUserDeleteDialog';
import { AdminUserEditModal } from '../../features/adminUsers/ui/AdminUserEditModal/AdminUserEditModal';
import { ADMIN_USER_BLOCK_ACTION_CONFIG } from '../../features/adminUsers/ui/adminUserActionConfig';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime } from '../../shared/lib/date';
import { BackButton } from '../../shared/ui/BackButton/BackButton';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DetailPage, type DetailPageSection } from '../../shared/ui/DetailPage/DetailPage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import styles from './AdminUserDetailPage.module.css';

const displayDate = (value: string) => value ? formatDateTime(value) : '—';

function getDetailSections(user: AdminUser): DetailPageSection[] {
  return [
    {
      key: 'personal',
      icon: <UserRound aria-hidden />,
      title: 'Shaxsiy ma’lumotlar',
      description: 'Foydalanuvchining asosiy aloqa ma’lumotlari',
      fields: [
        { key: 'name', icon: <UserRound />, label: 'To‘liq ism', value: user.name || '—' },
        { key: 'phone', icon: <Phone />, label: 'Telefon', value: user.phone || '—' },
        { key: 'email', icon: <Mail />, label: 'Email', value: user.email || '—' },
        { key: 'role', icon: <IdCard />, label: 'Rol', value: user.role },
      ],
    },
    {
      key: 'account',
      icon: <ShieldCheck aria-hidden />,
      title: 'Hisob holati',
      description: 'Ruxsatlar va backenddagi joriy holat',
      fields: [
        { key: 'id', icon: <IdCard />, label: 'Foydalanuvchi ID', value: `#${user.id}` },
        {
          key: 'shop',
          icon: <Store />,
          label: 'Do‘kon ID',
          value: user.shopId ? `#${user.shopId}` : 'Biriktirilmagan',
        },
        {
          key: 'active',
          icon: <ShieldCheck />,
          label: 'Faollik',
          value: <StatusTag status={user.isActive ? 'ACTIVE' : 'INACTIVE'} />,
        },
        {
          key: 'blocked',
          icon: <Ban />,
          label: 'Blok holati',
          value: <StatusTag status={user.blocked ? 'BLOCKED' : 'ACTIVE'} />,
        },
        {
          key: 'deleted',
          icon: <Trash2 />,
          label: 'O‘chirilgan',
          value: user.isDeleted ? 'Ha' : 'Yo‘q',
        },
      ],
    },
    {
      key: 'dates',
      icon: <CalendarClock aria-hidden />,
      title: 'Vaqt ma’lumotlari',
      description: 'Hisob yaratilgan va oxirgi yangilangan vaqt',
      fields: [
        {
          key: 'createdAt',
          icon: <CalendarClock />,
          label: 'Ro‘yxatdan o‘tgan',
          value: displayDate(user.createdAt),
        },
        {
          key: 'updatedAt',
          icon: <CalendarClock />,
          label: 'Yangilangan',
          value: displayDate(user.updatedAt),
        },
      ],
    },
  ];
}

export default function AdminUserDetailPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
            user.blocked ? 'Foydalanuvchi blokdan chiqarildi' : 'Foydalanuvchi bloklandi',
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
          title="Foydalanuvchi tafsilotlari"
          description={userId ? `Foydalanuvchi #${userId}` : 'Foydalanuvchi ma’lumoti'}
        />
        {!userId ? (
          <ContentState
            state="error"
            title="Foydalanuvchi aniqlanmadi"
            description="Foydalanuvchilar ro‘yxatiga qaytib, qayta urinib ko‘ring."
          />
        ) : userQuery.isError ? (
          <ContentState
            state="error"
            title="Foydalanuvchi ma’lumotini yuklab bo‘lmadi"
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
        title="Foydalanuvchi tafsilotlari"
        description={`Foydalanuvchi #${user.id}`}
        actions={
          <div className={styles.actions}>
            <Button icon={<Pencil size={17} />} onClick={() => setEditOpen(true)}>
              Tahrirlash
            </Button>
            <Button
              danger={blockAction.danger}
              icon={<blockAction.Icon size={17} />}
              loading={blockMutation.isPending}
              onClick={() => setBlockDialogOpen(true)}
            >
              {blockAction.label}
            </Button>
            <Button danger icon={<Trash2 size={17} />} onClick={() => setDeleteDialogOpen(true)}>
              O‘chirish
            </Button>
          </div>
        }
        hero={{
          avatarUrl: user.avatarUrl,
          avatarFallback: (user.name || user.phone || 'U').slice(0, 2).toUpperCase(),
          title: user.name || 'Nomsiz foydalanuvchi',
          subtitle: user.email || user.phone || 'Aloqa ma’lumoti kiritilmagan',
          badges: (
            <>
              <StatusTag status={user.blocked ? 'BLOCKED' : user.isActive ? 'ACTIVE' : 'INACTIVE'} />
              <span className={styles.role}>{user.role}</span>
            </>
          ),
        }}
        sections={getDetailSections(user)}
      />

      <AdminUserEditModal
        open={editOpen}
        user={user}
        onCancel={() => setEditOpen(false)}
      />

      <ConfirmDialog
        open={blockDialogOpen}
        title={user.blocked
          ? 'Foydalanuvchi blokdan chiqarilsinmi?'
          : 'Foydalanuvchi bloklansinmi?'}
        description={user.name || user.phone}
        confirmText={blockAction.label}
        danger={blockAction.danger}
        loading={blockMutation.isPending}
        onCancel={() => setBlockDialogOpen(false)}
        onConfirm={toggleBlocked}
      />

      <AdminUserDeleteDialog
        open={deleteDialogOpen}
        user={user}
        onCancel={() => setDeleteDialogOpen(false)}
        onDeleted={() => void navigate('/admin/users', { replace: true })}
      />
    </>
  );
}
