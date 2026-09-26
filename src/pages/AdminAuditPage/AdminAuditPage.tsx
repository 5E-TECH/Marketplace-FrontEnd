import { Input, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useAdminAuditLogsQuery } from '../../features/adminAudit/api/adminAuditQueries';
import type { AdminAuditLog } from '../../features/adminAudit/model/adminAuditTypes';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { formatDateTime } from '../../shared/lib/date';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { TABLE_PAGE_SIZE } from '../../shared/config/pagination';
import { ResetFiltersButton } from '../../shared/ui/ResetFiltersButton/ResetFiltersButton';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import { DateRangeFilter } from '../../shared/ui/DateRangeFilter/DateRangeFilter';
import { SearchInput } from '../../shared/ui/SearchInput/SearchInput';
import styles from './AdminAuditPage.module.css';

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
    limit: TABLE_PAGE_SIZE,
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
        <SearchInput
          value={actorId}
          placeholder={t('admin.audit.actorId')}
          aria-label={t('admin.audit.actorId')}
          onValueChange={(value) => { setActorId(value); setPage(1); }}
        />
        <Input
          value={action}
          allowClear
          placeholder={t('admin.audit.actionPlaceholder')}
          aria-label={t('admin.audit.action')}
          onChange={(event) => { setAction(event.target.value); setPage(1); }}
        />
        <DateRangeFilter
          value={[dateFrom, dateTo]}
          startLabel={t('admin.audit.dateFrom')}
          endLabel={t('admin.audit.dateTo')}
          onChange={([from, to]) => { setDateFrom(from); setDateTo(to); setPage(1); }}
        />
        <ResetFiltersButton
          disabled={!actorId && !action && !dateFrom && !dateTo}
          onClick={clearFilters}
        />
      </FilterPanel>

      {query.isPending ? <ContentState state="loading" /> : query.isError ? (
        <ContentState
          state="error"
          title={t('admin.audit.loadError')}
          description={getApiErrorMessage(query.error)}
          onAction={() => void query.refetch()}
        />
      ) : (
        <TablePanel title={t('admin.audit.logs')} caption={t('pagination.total', { total: query.data.total })}>
          <DataTable
            rowKey="id"
            className={styles.table}
            columns={columns}
            dataSource={query.data.items}
            emptyState={<EmptyState compact title={t('admin.audit.empty')} description={t('admin.audit.emptyDescription')} />}
            pagination={{ current: page, total: query.data.total, onChange: setPage }}
          />
        </TablePanel>
      )}
    </main>
  );
}
