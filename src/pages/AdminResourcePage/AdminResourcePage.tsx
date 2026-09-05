import { App, Button, Form, Input, Modal, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import { useLocation } from 'react-router-dom';
import { adminRouteTitle } from '../../features/adminDashboard/model/adminNavigation';
import { fetchData, handleCreate, handleDelete, handleUpdate, type AdminResourceRecord } from '../../features/adminDashboard/api/adminResourceService';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './AdminResourcePage.module.css';
import { formatDateTime } from '../../shared/lib/date';

type FormValue = Pick<AdminResourceRecord, 'name' | 'type' | 'status'>;
export default function AdminResourcePage() {
  const { pathname } = useLocation(); const title = adminRouteTitle(pathname); const { message } = App.useApp();
  const [rows, setRows] = useState<AdminResourceRecord[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [query, setQuery] = useState(''); const [status, setStatus] = useState('ALL'); const [selected, setSelected] = useState<Key[]>([]); const [editing, setEditing] = useState<AdminResourceRecord | null | undefined>(); const [deleting, setDeleting] = useState<string[]>([]); const [form] = Form.useForm<FormValue>();
  const load = () => { setLoading(true); setError(false); void fetchData().then(setRows).catch(() => setError(true)).finally(() => setLoading(false)); };
  useEffect(() => { let active = true; void fetchData().then((data) => { if (active) setRows(data); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [pathname]);
  const filtered = useMemo(() => rows.filter((row) => (status === 'ALL' || row.status === status) && row.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query, rows, status]);
  const columns: ColumnsType<AdminResourceRecord> = [{ title: 'Nomi', dataIndex: 'name', sorter: (a,b) => a.name.localeCompare(b.name) }, { title: 'Turi', dataIndex: 'type', responsive: ['md'] }, { title: 'Holati', dataIndex: 'status', render: (value) => <Tag color={value === 'ACTIVE' ? 'success' : value === 'PENDING' ? 'warning' : 'error'}>{value}</Tag> }, { title: 'Yangilangan', dataIndex: 'updatedAt', responsive: ['lg'], render: (value: string) => formatDateTime(value) }, { title: 'Amallar', width: 110, render: (_, row) => <Space><Button type="text" icon={<Pencil size={16}/>} aria-label="Tahrirlash" onClick={() => { setEditing(row); form.setFieldsValue(row); }} /><Button type="text" danger icon={<Trash2 size={16}/>} aria-label="O‘chirish" onClick={() => setDeleting([row.id])} /></Space> }];
  if (loading) return <ContentState state="loading" />; if (error) return <ContentState state="error" onAction={load} />;
  return <main><PageHeader title={title} description={`${title} bo‘limini boshqarish, moderatsiya va ommaviy amallar`} extra={<Button type="primary" icon={<Plus size={16}/>} onClick={() => { setEditing(null); form.resetFields(); }}>{title} qo‘shish</Button>} /><div className={styles.toolbar}><Input prefix={<Search />} allowClear value={query} placeholder="Qidirish..." onChange={(e) => setQuery(e.target.value)} /><Select value={status} onChange={setStatus} options={['ALL','ACTIVE','PENDING','BLOCKED'].map(value => ({ value, label: value === 'ALL' ? 'Barcha holatlar' : value }))} />{selected.length ? <Button danger icon={<Trash2 size={16}/>} onClick={() => setDeleting(selected.map(String))}>{selected.length} tani o‘chirish</Button> : null}</div><div className={styles.table}><Table rowKey="id" columns={columns} dataSource={filtered} rowSelection={{ selectedRowKeys: selected, onChange: setSelected }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: total => `Jami ${total} ta` }} scroll={{ x: 680 }} /></div>
    <Modal open={editing !== undefined} title={editing ? `${title}ni tahrirlash` : `Yangi ${title}`} okText="Saqlash" cancelText="Bekor" onCancel={() => setEditing(undefined)} onOk={() => void form.validateFields().then(async value => { const saved = editing ? await handleUpdate({ ...editing, ...value }) : await handleCreate(value); setRows(current => editing ? current.map(row => row.id === saved.id ? saved : row) : [saved, ...current]); setEditing(undefined); void message.success('Muvaffaqiyatli saqlandi'); })}><Form form={form} layout="vertical"><Form.Item name="name" label="Nomi" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="type" label="Turi" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="status" label="Holati" initialValue="PENDING" rules={[{ required: true }]}><Select options={['ACTIVE','PENDING','BLOCKED'].map(value => ({ value, label: value }))} /></Form.Item></Form></Modal>
    <ConfirmDialog open={deleting.length > 0} title="Yozuvlar o‘chirilsinmi?" description={`${deleting.length} ta yozuv o‘chiriladi.`} danger confirmText="O‘chirish" onCancel={() => setDeleting([])} onConfirm={async () => { await handleDelete(deleting); setRows(current => current.filter(row => !deleting.includes(row.id))); setSelected([]); setDeleting([]); void message.success('O‘chirildi'); }} />
  </main>;
}
