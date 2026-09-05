import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAdminCategoriesQuery, useCreateCategoryMutation, useDeleteCategoryMutation, useUpdateCategoryMutation } from '../../features/categories/api/categoryQueries';
import type { Category, CategoryPayload } from '../../features/categories/model/categoryTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';

interface CategoryValues { name: string; parentId?: string; iconUrl?: string; sortOrder: number; isActive: boolean }
function flatten(items: Category[]): Category[] { return items.flatMap((item) => [item, ...flatten(item.children)]); }
function payload(values: CategoryValues): CategoryPayload { return { name: values.name.trim(), parentId: values.parentId || null, iconUrl: values.iconUrl?.trim() || null, sortOrder: values.sortOrder, isActive: values.isActive }; }

export default function AdminCategoriesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<CategoryValues>();
  const [editing, setEditing] = useState<Category | null | undefined>();
  const [deleting, setDeleting] = useState<Category | null>(null);
  const query = useAdminCategoriesQuery();
  const create = useCreateCategoryMutation(); const update = useUpdateCategoryMutation(); const remove = useDeleteCategoryMutation();
  const flat = useMemo(() => flatten(query.data ?? []), [query.data]);
  const columns: ColumnsType<Category> = [
    { title: 'Nomi', dataIndex: 'name' },
    { title: 'Slug', dataIndex: 'slug', responsive: ['md'], render: (value: string) => value || '—' },
    { title: 'Tartib', dataIndex: 'sortOrder', width: 90 },
    { title: 'Holati', dataIndex: 'isActive', width: 110, render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? 'ACTIVE' : 'INACTIVE'}</Tag> },
    { title: 'Amallar', width: 110, render: (_, category) => <Space><Button type="text" icon={<Pencil size={16} />} aria-label={`${category.name} kategoriyasini tahrirlash`} onClick={() => { setEditing(category); form.setFieldsValue({ name: category.name, parentId: category.parentId ?? undefined, iconUrl: category.iconUrl ?? undefined, sortOrder: category.sortOrder, isActive: category.isActive }); }} /><Button type="text" danger icon={<Trash2 size={16} />} aria-label={`${category.name} kategoriyasini o‘chirish`} onClick={() => setDeleting(category)} /></Space> },
  ];
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title="Kategoriyalarni yuklab bo‘lmadi" description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />;
  const saving = create.isPending || update.isPending;
  return <main><PageHeader title="Kategoriyalar" description="Kategoriya va ichki kategoriyalar daraxtini boshqaring" extra={<Button type="primary" icon={<Plus />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ sortOrder: 0, isActive: true }); }}>Kategoriya qo‘shish</Button>} /><DataTable rowKey="id" columns={columns} dataSource={query.data} pagination={false} expandable={{ defaultExpandAllRows: true }} emptyState={<EmptyState title="Kategoriyalar yo‘q" description="Birinchi kategoriyani yarating." />} /><Modal title={editing ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'} open={editing !== undefined} okText="Saqlash" cancelText="Bekor qilish" confirmLoading={saving} onCancel={() => setEditing(undefined)} onOk={() => form.submit()} destroyOnHidden><Form<CategoryValues> form={form} layout="vertical" initialValues={{ sortOrder: 0, isActive: true }} onFinish={(values) => { const options = { onSuccess: () => { setEditing(undefined); void message.success('Kategoriya saqlandi'); }, onError: (error: Error) => void message.error(getAuthErrorMessage(error)) }; if (editing) update.mutate({ id: editing.id, payload: payload(values) }, options); else create.mutate(payload(values), options); }}><Form.Item name="name" label="Nomi" rules={[{ required: true, whitespace: true }, { max: 120 }]}><Input /></Form.Item><Form.Item name="parentId" label="Ota kategoriya"><Select allowClear showSearch optionFilterProp="label" options={flat.filter((item) => item.id !== editing?.id).map((item) => ({ value: item.id, label: item.name }))} /></Form.Item><Form.Item name="iconUrl" label="Icon URL" rules={[{ type: 'url' }]}><Input /></Form.Item><Form.Item name="sortOrder" label="Tartib raqami" rules={[{ required: true }]}><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item><Form.Item name="isActive" label="Faol" valuePropName="checked"><Switch /></Form.Item></Form></Modal><ConfirmDialog open={Boolean(deleting)} title="Kategoriya o‘chirilsinmi?" description="Ichki kategoriya yoki mahsulotlar mavjud bo‘lsa server o‘chirishni rad qilishi mumkin." confirmText="O‘chirish" danger loading={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => { if (!deleting) return; remove.mutate(deleting.id, { onSuccess: () => { setDeleting(null); void message.success('Kategoriya o‘chirildi'); }, onError: (error) => void message.error(getAuthErrorMessage(error)) }); }} /></main>;
}
