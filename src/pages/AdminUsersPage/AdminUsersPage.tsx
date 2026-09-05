import { App, Button, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRight, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAdminUsersQuery,
  useSetAdminUserBlockedMutation,
} from '../../features/adminUsers/api/adminUserQueries';
import { ADMIN_USER_ROLE_OPTIONS } from '../../features/adminUsers/model/adminUserOptions';
import type { AdminUser, AdminUserRole } from '../../features/adminUsers/model/adminUserTypes';
import { AdminUserDeleteDialog } from '../../features/adminUsers/ui/AdminUserDeleteDialog/AdminUserDeleteDialog';
import { ADMIN_USER_BLOCK_ACTION_CONFIG } from '../../features/adminUsers/ui/adminUserActionConfig';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime } from '../../shared/lib/date';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { IconActionButton } from '../../shared/ui/IconActionButton/IconActionButton';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import styles from './AdminUsersPage.module.css';

type RoleFilter = 'ALL' | AdminUserRole;
type BlockFilter = 'ALL' | 'BLOCKED' | 'ACTIVE';

export default function AdminUsersPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [block, setBlock] = useState<BlockFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pendingBlockAction, setPendingBlockAction] = useState<AdminUser | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const blockMutation = useSetAdminUserBlockedMutation();
  const query = useAdminUsersQuery({
    page,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(role !== 'ALL' ? { role } : {}),
    ...(block !== 'ALL' ? { blocked: block === 'BLOCKED' } : {}),
  });

  const columns = useMemo<ColumnsType<AdminUser>>(
    () => [
      {
        title: 'Foydalanuvchi',
        dataIndex: 'name',
        render: (value: string, row) => (
          <button
            className={styles.userLink}
            type="button"
            onClick={() => void navigate(`/admin/users/${row.id}`)}
          >
            {value || row.phone || `#${row.id}`}
          </button>
        ),
      },
      {
        title: 'Telefon',
        dataIndex: 'phone',
        responsive: ['sm'],
        render: (value: string) => value || '—',
      },
      { title: 'Rol', dataIndex: 'role', width: 130 },
      {
        title: 'Holati',
        dataIndex: 'blocked',
        width: 120,
        render: (value: boolean) => <StatusTag status={value ? 'BLOCKED' : 'ACTIVE'} />,
      },
      {
        title: 'Yaratilgan',
        dataIndex: 'createdAt',
        responsive: ['lg'],
        render: (value: string) => value ? formatDateTime(value) : '—',
      },
      {
        title: 'Amallar',
        width: 210,
        align: 'center',
        render: (_, row) => {
          const config = ADMIN_USER_BLOCK_ACTION_CONFIG[row.blocked ? 'blocked' : 'active'];
          return (
            <div className={styles.actions}>
              <Button
                className={styles.detailButton}
                type="link"
                onClick={() => void navigate(`/admin/users/${row.id}`)}
              >
                Tafsilotlar <ArrowRight size={15} aria-hidden />
              </Button>
              <IconActionButton
                danger={config.danger}
                icon={<config.Icon size={17} />}
                label={config.label}
                onClick={() => setPendingBlockAction(row)}
              />
              <IconActionButton
                danger
                icon={<Trash2 size={17} />}
                label="O‘chirish"
                onClick={() => setPendingDelete(row)}
              />
            </div>
          );
        },
      },
    ],
    [navigate],
  );

  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) {
    return (
      <ContentState
        state="error"
        title="Foydalanuvchilarni yuklab bo‘lmadi"
        description={getAuthErrorMessage(query.error)}
        onAction={() => void query.refetch()}
      />
    );
  }

  const hasFilters = Boolean(search) || role !== 'ALL' || block !== 'ALL';

  return (
    <main>
      <PageHeader
        title="Foydalanuvchilar"
        description="Platforma foydalanuvchilarini ko‘rish, bloklash va o‘chirishni boshqarish"
        extra={
          <Button
            type="primary"
            icon={<Plus size={17} />}
            onClick={() => void navigate('/admin/users/new')}
          >
            Foydalanuvchi qo‘shish
          </Button>
        }
      />

      <FilterPanel className={styles.toolbar} aria-label="Foydalanuvchi filtrlari">
        <Input
          prefix={<Search aria-hidden />}
          allowClear
          value={search}
          placeholder="Ism yoki telefon..."
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Select<RoleFilter>
          value={role}
          aria-label="Rol"
          options={[
            { value: 'ALL', label: 'Barcha rollar' },
            ...ADMIN_USER_ROLE_OPTIONS.map(({ value, label }) => ({ value, label })),
          ]}
          onChange={(value) => {
            setRole(value);
            setPage(1);
          }}
        />
        <Select<BlockFilter>
          value={block}
          aria-label="Blok holati"
          options={[
            { value: 'ALL', label: 'Barcha holatlar' },
            { value: 'ACTIVE', label: 'Faol' },
            { value: 'BLOCKED', label: 'Bloklangan' },
          ]}
          onChange={(value) => {
            setBlock(value);
            setPage(1);
          }}
        />
        <Button
          icon={<RotateCcw size={16} />}
          disabled={!hasFilters}
          onClick={() => {
            setSearch('');
            setRole('ALL');
            setBlock('ALL');
            setPage(1);
          }}
        >
          Tozalash
        </Button>
      </FilterPanel>

      <div className={styles.table}>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={query.data.items}
          scroll={{ x: 900 }}
          emptyState={
            <EmptyState
              compact
              title="Foydalanuvchilar topilmadi"
              description="Filterlarni o‘zgartirib ko‘ring."
            />
          }
          pagination={{
            ...createTablePagination(20),
            current: page,
            total: query.data.total,
          }}
          onChange={(value) => setPage(value.current ?? 1)}
        />
      </div>

      <ConfirmDialog
        open={Boolean(pendingBlockAction)}
        title={pendingBlockAction?.blocked
          ? 'Foydalanuvchi blokdan chiqarilsinmi?'
          : 'Foydalanuvchi bloklansinmi?'}
        description={pendingBlockAction?.name || pendingBlockAction?.phone || ''}
        confirmText={pendingBlockAction?.blocked ? 'Blokdan chiqarish' : 'Bloklash'}
        danger={!pendingBlockAction?.blocked}
        loading={blockMutation.isPending}
        onCancel={() => setPendingBlockAction(null)}
        onConfirm={() => {
          if (!pendingBlockAction) return;
          blockMutation.mutate(
            { id: pendingBlockAction.id, blocked: !pendingBlockAction.blocked },
            {
              onSuccess: () => {
                void message.success(
                  pendingBlockAction.blocked ? 'Blokdan chiqarildi' : 'Bloklandi',
                );
                setPendingBlockAction(null);
              },
              onError: (error) => void message.error(getAuthErrorMessage(error)),
            },
          );
        }}
      />

      <AdminUserDeleteDialog
        open={Boolean(pendingDelete)}
        user={pendingDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
