import { App, Avatar, Button, Input, Select, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Ban, Eye, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useAdminUserQuery, useAdminUsersQuery, useSetAdminUserBlockedMutation } from '../../features/adminUsers/api/adminUserQueries';
import type { AdminUser, AdminUserRole } from '../../features/adminUsers/model/adminUserTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime } from '../../shared/lib/date';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { DetailDrawer } from '../../shared/ui/DetailDrawer/DetailDrawer';
import { DetailList } from '../../shared/ui/DetailList/DetailList';
import styles from './AdminUsersPage.module.css';

type RoleFilter = 'ALL' | AdminUserRole;
type BlockFilter = 'ALL' | 'BLOCKED' | 'ACTIVE';
const roles: AdminUserRole[] = ['SELLER', 'OPERATOR', 'BUYER', 'ADMIN', 'SUPERADMIN'];

export default function AdminUsersPage() {
  const { message } = App.useApp();
  const [search, setSearch] = useState(''); const debouncedSearch = useDebouncedValue(search.trim());
  const [role, setRole] = useState<RoleFilter>('ALL'); const [block, setBlock] = useState<BlockFilter>('ALL'); const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [pendingAction, setPendingAction] = useState<AdminUser | null>(null);
  const query = useAdminUsersQuery({ page, limit: 20, ...(debouncedSearch ? { search: debouncedSearch } : {}), ...(role !== 'ALL' ? { role } : {}), ...(block !== 'ALL' ? { blocked: block === 'BLOCKED' } : {}) });
  const detail = useAdminUserQuery(selectedId); const mutation = useSetAdminUserBlockedMutation();
  const columns: ColumnsType<AdminUser> = [
    { title: 'Foydalanuvchi', dataIndex: 'name', render: (value: string, row) => value || row.phone || `#${row.id}` },
    { title: 'Telefon', dataIndex: 'phone', responsive: ['sm'], render: (value: string) => value || '—' },
    { title: 'Rol', dataIndex: 'role', width: 130 },
    { title: 'Holati', dataIndex: 'blocked', width: 120, render: (value: boolean) => <StatusTag status={value ? 'BLOCKED' : 'ACTIVE'} /> },
    { title: 'Yaratilgan', dataIndex: 'createdAt', responsive: ['lg'], render: (value: string) => value ? formatDateTime(value) : '—' },
    { title: 'Amallar', width: 110, align: 'center', render: (_, row) => <Space size={0}><Button type="text" icon={<Eye size={17} />} aria-label="Foydalanuvchi tafsilotlari" onClick={() => setSelectedId(row.id)} /><Button type="text" danger={!row.blocked} icon={row.blocked ? <ShieldCheck size={17} /> : <Ban size={17} />} aria-label={row.blocked ? 'Blokdan chiqarish' : 'Bloklash'} onClick={() => setPendingAction(row)} /></Space> },
  ];
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title="Foydalanuvchilarni yuklab bo‘lmadi" description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />;
  const hasFilters = Boolean(search) || role !== 'ALL' || block !== 'ALL';
  return <main><PageHeader title="Foydalanuvchilar" description="Platforma foydalanuvchilarini ko‘rish va bloklashni boshqarish" />
    <FilterPanel className={styles.toolbar} aria-label="Foydalanuvchi filtrlari"><Input prefix={<Search aria-hidden />} allowClear value={search} placeholder="Ism yoki telefon..." onChange={event => { setSearch(event.target.value); setPage(1); }} /><Select<RoleFilter> value={role} aria-label="Rol" options={[{ value: 'ALL', label: 'Barcha rollar' }, ...roles.map(value => ({ value, label: value }))]} onChange={value => { setRole(value); setPage(1); }} /><Select<BlockFilter> value={block} aria-label="Blok holati" options={[{ value: 'ALL', label: 'Barcha holatlar' }, { value: 'ACTIVE', label: 'Faol' }, { value: 'BLOCKED', label: 'Bloklangan' }]} onChange={value => { setBlock(value); setPage(1); }} /><Button icon={<RotateCcw size={16} />} disabled={!hasFilters} onClick={() => { setSearch(''); setRole('ALL'); setBlock('ALL'); setPage(1); }}>Tozalash</Button></FilterPanel>
    <div className={styles.table}><DataTable rowKey="id" columns={columns} dataSource={query.data.items} scroll={{ x: 760 }} emptyState={<EmptyState compact title="Foydalanuvchilar topilmadi" description="Filterlarni o‘zgartirib ko‘ring." />} pagination={{ ...createTablePagination(20), current: page, total: query.data.total }} onChange={value => setPage(value.current ?? 1)} /></div>
    <DetailDrawer title="Foydalanuvchi tafsilotlari" subtitle={selectedId ? `Foydalanuvchi #${selectedId}` : undefined} open={Boolean(selectedId)} onClose={() => setSelectedId(null)}>{detail.isPending ? <ContentState state="loading" /> : detail.isError ? <ContentState state="error" description={getAuthErrorMessage(detail.error)} onAction={() => void detail.refetch()} /> : detail.data ? <><div className={styles.profileHero}><Avatar size={54}>{(detail.data.name || detail.data.phone || 'U').slice(0, 2).toUpperCase()}</Avatar><div><strong>{detail.data.name || 'Nomsiz foydalanuvchi'}</strong><span>{detail.data.phone || 'Telefon kiritilmagan'}</span></div><StatusTag status={detail.data.blocked ? 'BLOCKED' : 'ACTIVE'} /></div><DetailList items={[{ label: 'Foydalanuvchi ID', value: `#${detail.data.id}` }, { label: 'Rol', value: detail.data.role }, { label: 'Telefon', value: detail.data.phone || '—' }, { label: 'Ro‘yxatdan o‘tgan', value: detail.data.createdAt ? formatDateTime(detail.data.createdAt) : '—' }]} /></> : null}</DetailDrawer>
    <ConfirmDialog open={Boolean(pendingAction)} title={pendingAction?.blocked ? 'Foydalanuvchi blokdan chiqarilsinmi?' : 'Foydalanuvchi bloklansinmi?'} description={pendingAction?.name || pendingAction?.phone || ''} confirmText={pendingAction?.blocked ? 'Blokdan chiqarish' : 'Bloklash'} danger={!pendingAction?.blocked} loading={mutation.isPending} onCancel={() => setPendingAction(null)} onConfirm={() => { if (!pendingAction) return; mutation.mutate({ id: pendingAction.id, blocked: !pendingAction.blocked }, { onSuccess: () => { void message.success(pendingAction.blocked ? 'Blokdan chiqarildi' : 'Bloklandi'); setPendingAction(null); } }); }} />
  </main>;
}
