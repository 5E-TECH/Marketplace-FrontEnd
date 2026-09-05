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

const statusOptions: Array<{ value: AdminResourceRecord['status']; label: string }> = [
  { value: 'ACTIVE', label: 'Faol' },
  { value: 'PENDING', label: 'Kutilmoqda' },
  { value: 'BLOCKED', label: 'Bloklangan' },
];

export default function AdminResourcePage() {
  const { pathname } = useLocation();
  const title = adminRouteTitle(pathname);
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
    { title: 'Nomi', dataIndex: 'name', sorter: (first, second) => first.name.localeCompare(second.name) },
    { title: 'Turi', dataIndex: 'type', responsive: ['md'] },
    { title: 'Holati', dataIndex: 'status', render: (value: AdminResourceRecord['status']) => <StatusTag status={value} /> },
    { title: 'Yangilangan', dataIndex: 'updatedAt', responsive: ['lg'], render: (value: string) => formatDateTime(value) },
    {
      title: 'Amallar',
      width: 112,
      align: 'center',
      render: (_, row) => (
        <div className={styles.actions}>
          <IconActionButton
            label="Tahrirlash"
            icon={<Pencil size={16} />}
            onClick={() => {
              setEditing(row);
              form.setFieldsValue(row);
            }}
          />
          <IconActionButton
            label="O‘chirish"
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
      void message.success('Muvaffaqiyatli saqlandi');
    } catch {
      void message.error('Ma’lumotni saqlab bo‘lmadi');
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
      void message.success('O‘chirildi');
    } catch {
      void message.error('Yozuvlarni o‘chirib bo‘lmadi');
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
        description={`${title} bo‘limini boshqarish, moderatsiya va ommaviy amallar`}
        extra={(
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              form.resetFields();
              setEditing(null);
            }}
          >
            {title} qo‘shish
          </Button>
        )}
      />
      <div className={styles.toolbar}>
        <Input prefix={<Search />} allowClear value={query} placeholder="Qidirish..." onChange={(event) => setQuery(event.target.value)} />
        <Select
          value={status}
          onChange={setStatus}
          options={[{ value: 'ALL', label: 'Barcha holatlar' }, ...statusOptions]}
        />
        {selected.length ? (
          <Button danger icon={<Trash2 size={16} />} onClick={() => setDeleting(selected.map(String))}>
            {selected.length} tani o‘chirish
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
          emptyState={<EmptyState compact title="Yozuvlar topilmadi" description="Qidiruv yoki holat filtrini o‘zgartirib ko‘ring." />}
        />
      </div>

      <FormModal<FormValue>
        open={editing !== undefined}
        title={editing ? `${title}ni tahrirlash` : `Yangi ${title}`}
        form={form}
        initialValues={{ status: 'PENDING' }}
        submitText="Saqlash"
        cancelText="Bekor"
        loading={saving}
        onCancel={() => setEditing(undefined)}
        onSubmit={save}
      >
        <Form.Item name="name" label="Nomi" rules={[{ required: true, whitespace: true, message: 'Nomini kiriting' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="type" label="Turi" rules={[{ required: true, whitespace: true, message: 'Turini kiriting' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="status" label="Holati" rules={[{ required: true, message: 'Holatini tanlang' }]}>
          <Select options={statusOptions} />
        </Form.Item>
      </FormModal>

      <ConfirmDialog
        open={deleting.length > 0}
        title="Yozuvlar o‘chirilsinmi?"
        description={`${deleting.length} ta yozuv o‘chiriladi.`}
        danger
        confirmText="O‘chirish"
        loading={deletePending}
        onCancel={() => setDeleting([])}
        onConfirm={removeSelected}
      />
    </main>
  );
}
