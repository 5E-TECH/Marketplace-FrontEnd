import { App, Button, Select, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useAdminShopsQuery, useApproveAdminShopMutation } from '../../features/adminShops/api/adminShopQueries';
import type { AdminShop, AdminShopStatus } from '../../features/adminShops/model/adminShopTypes';
import { getUserErrorMessage } from '../../features/users/lib/getUserErrorMessage';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { ListToolbar } from '../../shared/ui/ListToolbar/ListToolbar';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './AdminShopsPage.module.css';

type StatusFilter = 'ALL' | AdminShopStatus;
export default function AdminShopsPage() {
  const { message } = App.useApp(); const { language, t } = useTranslation();
  const [search, setSearch] = useState(''); const [status, setStatus] = useState<StatusFilter>('ALL'); const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim());
  const query = useAdminShopsQuery({ page, limit: 20, ...(debounced ? { search: debounced } : {}), ...(status !== 'ALL' ? { status } : {}) });
  const approve = useApproveAdminShopMutation();
  const columns: ColumnsType<AdminShop> = [
    { title: t('adminShops.market'), render: (_, shop) => <Typography.Text strong>{shop.name}</Typography.Text> },
    { title: t('adminShops.ownerId'), dataIndex: 'ownerUserId', width: 100, responsive: ['lg'], render: (value: string) => `#${value}` },
    { title: t('users.phone'), dataIndex: 'phone', responsive: ['sm'] },
    { title: t('adminShops.address'), dataIndex: 'address', responsive: ['lg'], render: (value: string | null) => value || '—' },
    { title: t('users.status'), dataIndex: 'status', width: 120, render: (value: AdminShopStatus) => <Tag color={value === 'ACTIVE' ? 'success' : value === 'PENDING' ? 'warning' : 'default'}>{value}</Tag> },
    { title: t('users.createdAt'), dataIndex: 'createdAt', responsive: ['lg'], render: (value: string) => value ? new Date(value).toLocaleDateString(language) : '—' },
    { title: t('users.actions'), width: 130, align: 'center', render: (_, shop) => shop.status === 'ACTIVE' ? <Typography.Text type="secondary">—</Typography.Text> : <Button className={styles.approve} icon={<Check size={16}/>} loading={approve.isPending && approve.variables === shop.id} disabled={approve.isPending || shop.status !== 'PENDING'} onClick={() => approve.mutate(shop.id, { onSuccess: () => void message.success(t('adminShops.approved')), onError: (error) => void message.error(getUserErrorMessage(error, language)) })}>{t('adminShops.approve')}</Button> },
  ];
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title={t('adminShops.loadError')} description={getUserErrorMessage(query.error, language)} onAction={() => void query.refetch()} />;
  return <main className={styles.page}>
    <PageHeader title={t('adminShops.title')} description={t('adminShops.description')} />
    <ListToolbar value={search} placeholder={t('adminShops.search')} onChange={(value) => { setSearch(value); setPage(1); }} actions={<Select<StatusFilter> className={styles.filter} value={status} options={['ALL','PENDING','ACTIVE','INACTIVE','SUSPENDED','REJECTED'].map((value) => ({ value, label: value === 'ALL' ? t('users.allStatuses') : value }))} onChange={(value) => { setStatus(value); setPage(1); }} />} />
    <DataTable rowKey="id" columns={columns} dataSource={query.data.items} tableLayout="auto" emptyState={<EmptyState compact title={t('adminShops.empty')} description={t('adminShops.emptyDescription')} />} pagination={{ ...createTablePagination(20), current: page, total: query.data.total }} onChange={(pagination) => setPage(pagination.current ?? 1)} />
  </main>;
}
