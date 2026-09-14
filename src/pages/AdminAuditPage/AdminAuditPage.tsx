import { Button, Input, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useAdminAuditLogsQuery } from '../../features/adminAudit/api/adminAuditQueries';
import type { AdminAuditLog } from '../../features/adminAudit/model/adminAuditTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { formatDateTime } from '../../shared/lib/date';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './AdminAuditPage.module.css';

const PAGE_SIZE = 20;

export default function AdminAuditPage() {
  const { locale, t } = useTranslation();
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const debouncedActorId = useDebouncedValue(actorId.trim());
  const debouncedAction = useDebouncedValue(action.trim());
  const query = useAdminAuditLogsQuery({
    page,
    limit: PAGE_SIZE,
    ...(debouncedActorId ? { actorId: debouncedActorId } : {}),
    ...(debouncedAction ? { action: debouncedAction } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  });

  const columns: ColumnsType<AdminAuditLog> = [
    {
      title: t('admin.audit.date'),
      dataIndex: 'createdAt',
      width: 190,
      render: (value: string) => formatDateTime(value, locale),
    },
    {
      title: t('admin.audit.actor'),
      render: (_, row) => (
        <div className={styles.actor}>
          <Typography.Text strong>{row.actorName || t('admin.audit.unknownActor')}</Typography.Text>
          <span>{row.actorId ? `#${row.actorId}` : '—'}</span>
        </div>
      ),
    },
    {
      title: t('admin.audit.action'),
      dataIndex: 'action',
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: t('admin.audit.object'),
      render: (_, row) => (
        <div className={styles.object}>
          <span>{row.objectType || t('common.unknown')}</span>
          {row.objectId ? <Typography.Text type="secondary">#{row.objectId}</Typography.Text> : null}
        </div>
      ),
    },
  ];

  const clearFilters = () => {
    setActorId('');
    setAction('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <main className={styles.page}>
      <PageHeader title={t('admin.audit.title')} description={t('admin.audit.description')} />
      <FilterPanel className={styles.filters} aria-label={t('admin.common.filters')}>
        <Input
          value={actorId}
          allowClear
          placeholder={t('admin.audit.actorId')}
          aria-label={t('admin.audit.actorId')}
          onChange={(event) => { setActorId(event.target.value); setPage(1); }}
        />
        <Input
          value={action}
          allowClear
          placeholder={t('admin.audit.actionPlaceholder')}
          aria-label={t('admin.audit.action')}
          onChange={(event) => { setAction(event.target.value); setPage(1); }}
        />
        <Input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          aria-label={t('admin.audit.dateFrom')}
          onChange={(event) => { setDateFrom(event.target.value); setPage(1); }}
        />
        <Input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          aria-label={t('admin.audit.dateTo')}
          onChange={(event) => { setDateTo(event.target.value); setPage(1); }}
        />
        <Button
          icon={<RotateCcw size={16} />}
          disabled={!actorId && !action && !dateFrom && !dateTo}
          onClick={clearFilters}
        >
          {t('admin.audit.clear')}
        </Button>
      </FilterPanel>

      {query.isPending ? <ContentState state="loading" /> : query.isError ? (
        <ContentState
          state="error"
          title={t('admin.audit.loadError')}
          description={getAuthErrorMessage(query.error)}
          onAction={() => void query.refetch()}
        />
      ) : (
        <TablePanel title={t('admin.audit.logs')} caption={t('pagination.total', { total: query.data.total })}>
          <DataTable
            rowKey="id"
            className={styles.table}
            columns={columns}
            dataSource={query.data.items}
            scroll={{ x: 760 }}
            emptyState={<EmptyState compact title={t('admin.audit.empty')} description={t('admin.audit.emptyDescription')} />}
            pagination={{
              ...createTablePagination(PAGE_SIZE, (total) => t('pagination.total', { total })),
              current: page,
              total: query.data.total,
            }}
            onChange={(pagination) => setPage(pagination.current ?? 1)}
          />
        </TablePanel>
      )}
    </main>
  );
}
