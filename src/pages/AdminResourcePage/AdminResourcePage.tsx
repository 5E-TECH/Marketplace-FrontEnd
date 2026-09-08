import { App, Button, Form, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type Key } from 'react';
import { useLocation } from 'react-router-dom';
import {
  fetchData,
  handleCreate,
  handleDelete,
  handleUpdate,
  type AdminResourceRecord,
} from '../../features/adminDashboard/api/adminResourceService';
import { adminRouteTitle } from '../../features/adminDashboard/model/adminNavigation';
import { formatDateTime } from '../../shared/lib/date';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { IconActionButton } from '../../shared/ui/IconActionButton/IconActionButton';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import styles from './AdminResourcePage.module.css';

type FormValue = Pick<AdminResourceRecord, 'name' | 'type' | 'status'>;

export default function AdminResourcePage() {
  const { pathname } = useLocation();
  const { locale, t } = useTranslation();
  const title = t(adminRouteTitle(pathname));
  const statusOptions: Array<{ value: AdminResourceRecord['status']; label: string }> = [
    { value: 'ACTIVE', label: t('status.active') },
    { value: 'PENDING', label: t('status.pending') },
    { value: 'BLOCKED', label: t('status.blocked') },
  ];
  const { message } = App.useApp();
  const [rows, setRows] = useState<AdminResourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | AdminResourceRecord['status']>('ALL');
  const [selected, setSelected] = useState<Key[]>([]);
  const [editing, setEditing] = useState<AdminResourceRecord | null | undefined>();
  const [deleting, setDeleting] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [form] = Form.useForm<FormValue>();

  const load = () => {
    setLoading(true);
    setError(false);
    void fetchData()
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    void fetchData()
      .then((data) => {
        if (active) {
          setRows(data);
          setError(false);
        }
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pathname]);

  const filtered = useMemo(
    () => rows.filter((row) =>
      (status === 'ALL' || row.status === status)
      && row.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    ),
    [query, rows, status],
  );

  const columns: ColumnsType<AdminResourceRecord> = [
    { title: t('admin.common.name'), dataIndex: 'name', sorter: (first, second) => first.name.localeCompare(second.name) },
    { title: t('admin.resource.type'), dataIndex: 'type', responsive: ['md'] },
    { title: t('common.status'), dataIndex: 'status', render: (value: AdminResourceRecord['status']) => <StatusTag status={value} /> },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', responsive: ['lg'], render: (value: string) => formatDateTime(value, locale) },
    {
      title: t('common.actions'),
      width: 112,
      align: 'center',
      render: (_, row) => (
        <div className={styles.actions}>
          <IconActionButton
            label={t('common.edit')}
            icon={<Pencil size={16} />}
            onClick={() => {
              setEditing(row);
              form.setFieldsValue(row);
            }}
          />
          <IconActionButton
            label={t('common.delete')}
            icon={<Trash2 size={16} />}
            danger
            onClick={() => setDeleting([row.id])}
          />
        </div>
      ),
    },
  ];

  const save = async (values: FormValue) => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = editing
        ? await handleUpdate({ ...editing, ...values })
        : await handleCreate(values);
      setRows((current) => editing
        ? current.map((row) => row.id === saved.id ? saved : row)
        : [saved, ...current]);
      setEditing(undefined);
      void message.success(t('admin.resource.saved'));
    } catch {
      void message.error(t('admin.resource.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const removeSelected = async () => {
    if (!deleting.length || deletePending) return;
    setDeletePending(true);
    try {
      await handleDelete(deleting);
      setRows((current) => current.filter((row) => !deleting.includes(row.id)));
      setSelected([]);
      setDeleting([]);
      void message.success(t('admin.resource.deleted'));
    } catch {
      void message.error(t('admin.resource.deleteError'));
    } finally {
      setDeletePending(false);
    }
  };

  if (loading) return <ContentState state="loading" />;
  if (error) return <ContentState state="error" onAction={load} />;

  return (
    <main>
      <PageHeader
        title={title}
        description={t('admin.resource.description', { name: title })}
        extra={(
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              form.resetFields();
              setEditing(null);
            }}
          >
            {t('admin.resource.add', { name: title })}
          </Button>
        )}
      />
      <div className={styles.toolbar}>
        <Input prefix={<Search />} allowClear value={query} placeholder={t('admin.resource.search')} onChange={(event) => setQuery(event.target.value)} />
        <Select
          value={status}
          onChange={setStatus}
          options={[{ value: 'ALL', label: t('admin.resource.allStatuses') }, ...statusOptions]}
        />
        {selected.length ? (
          <Button danger icon={<Trash2 size={16} />} onClick={() => setDeleting(selected.map(String))}>
            {t('admin.resource.bulkDelete', { count: selected.length })}
          </Button>
        ) : null}
      </div>
      <div className={styles.table}>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
          pagination={{ ...createTablePagination(10), total: filtered.length }}
          scroll={{ x: 680 }}
          emptyState={<EmptyState compact title={t('admin.resource.empty')} description={t('admin.resource.emptyDescription')} />}
        />
      </div>

      <FormModal<FormValue>
        open={editing !== undefined}
        title={editing ? t('admin.resource.edit', { name: title }) : t('admin.resource.add', { name: title })}
        form={form}
        initialValues={{ status: 'PENDING' }}
        submitText={t('common.save')}
        cancelText={t('common.cancel')}
        loading={saving}
        onCancel={() => setEditing(undefined)}
        onSubmit={save}
      >
        <Form.Item name="name" label={t('admin.common.name')} rules={[{ required: true, whitespace: true, message: t('admin.resource.nameRequired') }]}>
          <Input />
        </Form.Item>
        <Form.Item name="type" label={t('admin.resource.type')} rules={[{ required: true, whitespace: true, message: t('admin.resource.typeRequired') }]}>
          <Input />
        </Form.Item>
        <Form.Item name="status" label={t('common.status')} rules={[{ required: true, message: t('admin.resource.statusRequired') }]}>
          <Select options={statusOptions} />
        </Form.Item>
      </FormModal>

      <ConfirmDialog
        open={deleting.length > 0}
        title={t('admin.resource.deleteTitle')}
        description={t('admin.resource.deleteCount', { count: deleting.length })}
        danger
        confirmText={t('common.delete')}
        loading={deletePending}
        onCancel={() => setDeleting([])}
        onConfirm={removeSelected}
      />
    </main>
  );
}
