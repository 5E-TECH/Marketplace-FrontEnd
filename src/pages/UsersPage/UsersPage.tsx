import { Pencil, Plus, Trash2 } from 'lucide-react';
import { App, Button, Form, Select, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteUserMutation, useUpdateUserMutation, useUsersQuery } from '../../features/users/api/userQueries';
import type { ManagedUser } from '../../features/users/model/userTypes';
import { getUserErrorMessage } from '../../features/users/lib/getUserErrorMessage';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { ListToolbar } from '../../shared/ui/ListToolbar/ListToolbar';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { TextControl } from '../../shared/ui/FormControls/FormControls';
import { PasswordInput } from '../../shared/ui/PasswordInput/PasswordInput';
import { getApiFieldErrors } from '../../features/auth/lib/getAuthErrorMessage';
import styles from './UsersPage.module.css';
import { formatDate } from '../../shared/lib/date';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
interface EditUserValues { name: string; phone: string; password?: string }
export default function UsersPage() {
  const navigate = useNavigate(); const { message } = App.useApp(); const { language, t } = useTranslation();
  const [search, setSearch] = useState(''); const [status, setStatus] = useState<StatusFilter>('ALL'); const [page, setPage] = useState(1); const [deleting, setDeleting] = useState<ManagedUser | null>(null); const [editing, setEditing] = useState<ManagedUser | null>(null); const [editForm] = Form.useForm<EditUserValues>();
  const debounced = useDebouncedValue(search.trim()); const query = useUsersQuery({ page, limit: 20, ...(debounced ? { search: debounced } : {}), ...(status !== 'ALL' ? { isActive: status === 'ACTIVE' } : {}) }); const deleteMutation = useDeleteUserMutation(); const updateMutation = useUpdateUserMutation();
  const columns: ColumnsType<ManagedUser> = [
    { title: t('users.user'), render: (_, user) => <Typography.Text strong>{user.name}</Typography.Text> },
    { title: t('users.phone'), dataIndex: 'phone', responsive: ['sm'] },
    { title: t('users.role'), dataIndex: 'role', width: 120, responsive: ['md'], render: (role: string) => <Tag>{role}</Tag> },
    { title: t('users.status'), width: 110, render: (_, user) => <Tag color={user.isBlocked ? 'error' : user.isActive ? 'success' : 'default'}>{user.isBlocked ? 'BLOCKED' : user.isActive ? t('users.active') : t('users.inactive')}</Tag> },
    { title: t('users.createdAt'), dataIndex: 'createdAt', responsive: ['lg'], render: (value: string) => formatDate(value, language) },
    { title: t('users.actions'), width: 104, align: 'center', render: (_, user) => <span className={styles.rowActions}><Button type="text" icon={<Pencil size={16}/>} aria-label={t('users.edit')} onClick={() => { setEditing(user); editForm.setFieldsValue({ name: user.name, phone: user.phone, password: '' }); }} /><Button type="text" danger icon={<Trash2 size={16}/>} aria-label={t('users.delete')} onClick={() => setDeleting(user)} /></span> },
  ];
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title={t('users.loadError')} description={getUserErrorMessage(query.error, language)} onAction={() => void query.refetch()} />;
  return <main className={styles.page}><PageHeader title={t('users.title')} description={t('users.description')} extra={<Button className={styles.addButton} icon={<Plus/>} onClick={() => void navigate('/users/new')}>{t('users.add')}</Button>} />
    <ListToolbar value={search} placeholder={t('users.search')} onChange={(value) => { setSearch(value); setPage(1); }} actions={<Select<StatusFilter> className={styles.filter} value={status} options={[{ value: 'ALL', label: t('users.allStatuses') }, { value: 'ACTIVE', label: t('users.active') }, { value: 'INACTIVE', label: t('users.inactive') }]} onChange={(value) => { setStatus(value); setPage(1); }} />} />
    <DataTable rowKey="id" columns={columns} dataSource={query.data.items} tableLayout="auto" emptyState={<EmptyState compact title={t('users.empty')} description={t('users.emptyDescription')} />} pagination={{ ...createTablePagination(20), current: page, total: query.data.total }} onChange={(pagination) => setPage(pagination.current ?? 1)} />
    <FormModal<EditUserValues> open={Boolean(editing)} title={t('users.editTitle')} form={editForm} submitText={t('users.saveChanges')} loading={updateMutation.isPending} onCancel={() => setEditing(null)} onSubmit={(values) => { if (!editing) return; updateMutation.mutate({ id: editing.id, name: values.name.trim(), phone: values.phone.replace(/\s/g, ''), ...(values.password?.trim() ? { password: values.password } : {}) }, { onSuccess: () => { setEditing(null); void message.success(t('users.updated')); }, onError: (error) => { const fields = getApiFieldErrors(error).filter(({ name }) => ['name', 'phone', 'password'].includes(name)); if (fields.length) editForm.setFields(fields.map(({ name, errors }) => ({ name: [name as keyof EditUserValues], errors }))); void message.error(getUserErrorMessage(error, language)); } }); }}>
      <Form.Item label={t('users.name')} name="name" rules={[{ required: true, whitespace: true, message: t('users.nameRequired') }, { max: 255 }]}><TextControl maxLength={255} /></Form.Item>
      <Form.Item label={t('users.phone')} name="phone" rules={[{ required: true, message: t('users.phoneRequired') }, { pattern: /^\+998\d{9}$/, message: t('users.phoneInvalid') }]}><TextControl /></Form.Item>
      <Form.Item label={t('users.newPassword')} name="password" rules={[{ min: 4, message: t('users.passwordMin') }]}><PasswordInput autoComplete="new-password" /></Form.Item>
    </FormModal>
    <ConfirmDialog open={Boolean(deleting)} title={t('users.deleteTitle')} description={t('users.deleteDescription')} confirmText={t('users.delete')} danger loading={deleteMutation.isPending} onCancel={() => setDeleting(null)} onConfirm={() => { if (!deleting) return; deleteMutation.mutate(deleting.id, { onSuccess: () => { setDeleting(null); void message.success(t('users.deleted')); }, onError: (error) => void message.error(getUserErrorMessage(error, language)) }); }} />
  </main>;
}
