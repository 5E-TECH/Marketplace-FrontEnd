import { Plus } from 'lucide-react';
import { App, Button, Form } from 'antd';
import { useState } from 'react';
import { useCreateWarehouseMutation, useSetDefaultWarehouseMutation, useWarehousesQuery } from '../../features/warehouses/api/warehouseQueries';
import type { Warehouse, WarehousePayload } from '../../features/warehouses/model/warehouseTypes';
import { WarehouseFormModal, type WarehouseFormValues } from '../../features/warehouses/ui/WarehouseFormModal';
import { WarehouseTable } from '../../features/warehouses/ui/WarehouseTable';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { ContentState } from '../../shared/ui/ContentState/ContentState';

function toPayload(values: WarehouseFormValues): WarehousePayload {
  return {
    name: values.name.trim(),
    ...(values.regionId?.trim() ? { regionId: values.regionId.trim() } : {}),
    ...(values.districtId?.trim() ? { districtId: values.districtId.trim() } : {}),
    ...(values.address?.trim() ? { address: values.address.trim() } : {}),
    isDefault: values.isDefault === true,
  };
}

export default function WarehousesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<WarehouseFormValues>();
  const [createOpen, setCreateOpen] = useState(false);
  const warehousesQuery = useWarehousesQuery();
  const createMutation = useCreateWarehouseMutation();
  const defaultMutation = useSetDefaultWarehouseMutation();

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
    <PageHeader title="Omborlar" description="Mahsulot qoldiqlarini omborlar bo‘yicha boshqaring" extra={<Button type="primary" icon={<Plus />} onClick={() => setCreateOpen(true)}>Ombor qo‘shish</Button>} />
    <WarehouseTable warehouses={warehousesQuery.data} changingDefaultId={defaultMutation.isPending ? defaultMutation.variables : undefined} onMakeDefault={makeDefault} />
    <WarehouseFormModal open={createOpen} loading={createMutation.isPending} makeDefaultInitially={warehousesQuery.data.length === 0} form={form} onCancel={() => setCreateOpen(false)} onSubmit={create} />
  </main>;
}
