import { Plus } from 'lucide-react';
import { App, Button, Form } from 'antd';
import { useState } from 'react';
import { useCreateWarehouseMutation, useDeleteWarehouseMutation, useSetDefaultWarehouseMutation, useUpdateWarehouseMutation, useWarehouseQuery, useWarehousesQuery } from '../../features/warehouses/api/warehouseQueries';
import type { Warehouse, WarehousePayload } from '../../features/warehouses/model/warehouseTypes';
import { WarehouseFormModal, type WarehouseFormValues } from '../../features/warehouses/ui/WarehouseFormModal';
import { WarehouseTable } from '../../features/warehouses/ui/WarehouseTable';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';

function toPayload(values: WarehouseFormValues): WarehousePayload {
  return {
    name: values.name.trim(),
    regionId: values.regionId?.trim() || null,
    districtId: values.districtId?.trim() || null,
    address: values.address?.trim() || null,
    isDefault: values.isDefault === true,
  };
}

export default function WarehousesPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm<WarehouseFormValues>();
  const [editForm] = Form.useForm<WarehouseFormValues>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
  const warehousesQuery = useWarehousesQuery();
  const createMutation = useCreateWarehouseMutation();
  const defaultMutation = useSetDefaultWarehouseMutation();
  const updateMutation = useUpdateWarehouseMutation();
  const deleteMutation = useDeleteWarehouseMutation();
  const detailQuery = useWarehouseQuery(editing?.id ?? null);

  const makeDefault = (warehouse: Warehouse) => {
    if (warehouse.isDefault || defaultMutation.isPending) return;
    defaultMutation.mutate(warehouse.id, {
      onSuccess: () => void message.success(`${warehouse.name} asosiy ombor qilindi`),
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  const create = (values: WarehouseFormValues) => {
    createMutation.mutate(toPayload(values), {
      onSuccess: () => { setCreateOpen(false); void message.success('Ombor qo‘shildi'); },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  if (warehousesQuery.isPending) return <ContentState state="loading" />;
  if (warehousesQuery.isError) return <ContentState state="error" title="Omborlarni yuklab bo‘lmadi" description={getAuthErrorMessage(warehousesQuery.error)} onAction={() => void warehousesQuery.refetch()} />;

  return <main>
    <PageHeader title={t('warehouse.title')} description={t('warehouse.description')} extra={<Button type="primary" icon={<Plus />} onClick={() => setCreateOpen(true)}>{t('warehouse.add')}</Button>} />
    <WarehouseTable warehouses={warehousesQuery.data} changingDefaultId={defaultMutation.isPending ? defaultMutation.variables : undefined} onMakeDefault={makeDefault} onEdit={setEditing} onDelete={setDeleting} />
    <WarehouseFormModal open={createOpen} loading={createMutation.isPending} makeDefaultInitially={warehousesQuery.data.length === 0} form={form} onCancel={() => setCreateOpen(false)} onSubmit={create} />
    <WarehouseFormModal open={Boolean(editing)} loading={updateMutation.isPending || detailQuery.isPending} makeDefaultInitially={false} title="Omborni tahrirlash" submitText="Saqlash" initialValues={editing ? { name: editing.name, regionId: editing.regionId ?? undefined, districtId: editing.districtId ?? undefined, address: editing.address ?? undefined, isDefault: editing.isDefault } : undefined} form={editForm} onCancel={() => setEditing(null)} onSubmit={(values) => { if (!editing) return; updateMutation.mutate({ id: editing.id, payload: toPayload(values) }, { onSuccess: () => { setEditing(null); void message.success('Ombor yangilandi'); }, onError: (error) => void message.error(getAuthErrorMessage(error)) }); }} />
    <ConfirmDialog open={Boolean(deleting)} title="Ombor o‘chirilsinmi?" description={`${deleting?.name ?? 'Ombor'} ro‘yxatdan olib tashlanadi.`} confirmText="O‘chirish" danger loading={deleteMutation.isPending} onCancel={() => setDeleting(null)} onConfirm={() => { if (!deleting) return; deleteMutation.mutate(deleting.id, { onSuccess: () => { setDeleting(null); void message.success('Ombor o‘chirildi'); }, onError: (error) => void message.error(getAuthErrorMessage(error)) }); }} />
  </main>;
}
