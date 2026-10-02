import { App, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAdminUsersQuery,
  useSetAdminUserBlockedMutation,
} from '../../features/adminUsers/api/adminUserQueries';
import { ADMIN_USER_ROLE_OPTIONS } from '../../features/adminUsers/model/adminUserOptions';
import type { AdminUser, AdminUserRole } from '../../features/adminUsers/model/adminUserTypes';
import {
  ADMIN_USER_BLOCK_ACTION_CONFIG,
} from '../../features/adminUsers/ui/adminUserActionConfig';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { formatDateTime } from '../../shared/lib/date';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { TABLE_PAGE_SIZE } from '../../shared/config/pagination';
import { ResetFiltersButton } from '../../shared/ui/ResetFiltersButton/ResetFiltersButton';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { IconActionButton } from '../../shared/ui/IconActionButton/IconActionButton';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import { SearchInput } from '../../shared/ui/SearchInput/SearchInput';
import { FilterSelect } from '../../shared/ui/FilterPanel/FilterSelect';
import styles from './AdminUsersPage.module.css';

type RoleFilter = 'ALL' | AdminUserRole;
type BlockFilter = 'ALL' | 'BLOCKED' | 'ACTIVE';

export default function AdminUsersPage() {
  const { message } = App.useApp();
  const { locale, t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [block, setBlock] = useState<BlockFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pendingBlockAction, setPendingBlockAction] = useState<AdminUser | null>(null);
  const blockMutation = useSetAdminUserBlockedMutation();
  const query = useAdminUsersQuery({
    page,
    limit: TABLE_PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(role !== 'ALL' ? { role } : {}),
    ...(block !== 'ALL' ? { blocked: block === 'BLOCKED' } : {}),
  });

  const columns = useMemo<ColumnsType<AdminUser>>(
    () => [
      {
        title: t('admin.users.user'),
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
        title: t('admin.users.phone'),
        dataIndex: 'phone',
        responsive: ['sm'],
        render: (value: string) => value || '—',
      },
      {
        title: t('admin.users.role'),
        dataIndex: 'role',
        width: 160,
        render: (value: AdminUserRole) => {
          const option = ADMIN_USER_ROLE_OPTIONS.find((item) => item.value === value);
          return option ? t(option.label) : value;
        },
      },
      {
        title: t('common.status'),
        dataIndex: 'blocked',
        width: 120,
        render: (value: boolean, row) => (
          <StatusTag status={value ? 'BLOCKED' : row.isActive ? 'ACTIVE' : 'INACTIVE'} />
        ),
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'createdAt',
        responsive: ['lg'],
        render: (value: string) => value ? formatDateTime(value, locale) : '—',
      },
      {
        title: t('common.actions'),
        width: 160,
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
                {t('common.details')} <ArrowRight size={15} aria-hidden />
              </Button>
              <IconActionButton
                danger={config.danger}
                icon={<config.Icon size={17} />}
                label={t(config.label)}
                onClick={() => setPendingBlockAction(row)}
              />
            </div>
          );
        },
      },
    ],
    [locale, navigate, t],
  );

  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) {
    return (
      <ContentState
        state="error"
        title={t('admin.users.loadError')}
        description={getApiErrorMessage(query.error)}
        onAction={() => void query.refetch()}
      />
    );
  }

  const hasFilters = Boolean(search) || role !== 'ALL' || block !== 'ALL';

  return (
    <main>
      <PageHeader
        title={t('admin.users.title')}
        description={t('admin.users.description')}
        extra={
          <Button
            type="primary"
            icon={<Plus size={17} />}
            onClick={() => void navigate('/admin/users/new')}
          >
            {t('admin.users.add')}
          </Button>
        }
      />

      <FilterPanel className={styles.toolbar} aria-label={t('admin.common.filters')}>
        <SearchInput
          value={search}
          placeholder={t('admin.users.search')}
          onValueChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <FilterSelect<RoleFilter>
          value={role}
          aria-label={t('admin.users.role')}
          options={[
            { value: 'ALL', label: t('admin.users.allRoles') },
            ...ADMIN_USER_ROLE_OPTIONS.map(({ value, label }) => ({ value, label: t(label) })),
          ]}
          onChange={(value) => {
            setRole(value);
            setPage(1);
          }}
        />
        <FilterSelect<BlockFilter>
          value={block}
          aria-label={t('admin.users.blockStatus')}
          options={[
            { value: 'ALL', label: t('admin.users.allStatuses') },
            { value: 'ACTIVE', label: t('status.active') },
            { value: 'BLOCKED', label: t('status.blocked') },
          ]}
          onChange={(value) => {
            setBlock(value);
            setPage(1);
          }}
        />
        <ResetFiltersButton
          disabled={!hasFilters}
          onClick={() => {
            setSearch('');
            setRole('ALL');
            setBlock('ALL');
            setPage(1);
          }}
        />
      </FilterPanel>

      <TablePanel title={t('admin.users.user')} caption={t('pagination.total', { total: query.data.total })}>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={query.data.items}
          emptyState={
            <EmptyState
              compact
              title={t('admin.users.empty')}
              description={t('admin.users.emptyDescription')}
            />
          }
          pagination={{ current: page, total: query.data.total, onChange: setPage }}
        />
      </TablePanel>

      <ConfirmDialog
        open={Boolean(pendingBlockAction)}
        title={pendingBlockAction?.blocked
          ? t('admin.users.unblockTitle')
          : t('admin.users.blockTitle')}
        description={pendingBlockAction?.name || pendingBlockAction?.phone || ''}
        confirmText={pendingBlockAction?.blocked ? t('admin.users.unblock') : t('admin.users.block')}
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
                  pendingBlockAction.blocked ? t('admin.users.unblocked') : t('admin.users.blocked'),
                );
                setPendingBlockAction(null);
              },
              onError: (error) => void message.error(getApiErrorMessage(error)),
            },
          );
        }}
      />
    </main>
  );
}
