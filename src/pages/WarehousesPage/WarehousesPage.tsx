import { MapPin, Plus, Star } from 'lucide-react';
import { App, Button, Card, Form, Switch, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { useCreateWarehouseMutation, useSetDefaultWarehouseMutation, useWarehousesQuery } from '../../features/warehouses/api/warehouseQueries';
import type { Warehouse, WarehousePayload } from '../../features/warehouses/model/warehouseTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { TextControl } from '../../shared/ui/FormControls/FormControls';

type WarehouseFormValues = Omit<WarehousePayload, 'isDefault'> & { isDefault?: boolean };

export default function WarehousesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<WarehouseFormValues>();
  const [open, setOpen] = useState(false);
  const warehousesQuery = useWarehousesQuery();
  const createMutation = useCreateWarehouseMutation();
  const defaultMutation = useSetDefaultWarehouseMutation();

  const makeDefault = (warehouse: Warehouse) => {
    if (warehouse.isDefault) return;
    defaultMutation.mutate(warehouse.id, {
      onSuccess: () => void message.success(`${warehouse.name} asosiy ombor qilindi`),
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  const columns: ColumnsType<Warehouse> = [
    { title: 'Ombor', dataIndex: 'name', render: (name: string) => <Typography.Text strong>{name}</Typography.Text> },
    { title: 'Manzil', dataIndex: 'address', render: (address: string | null) => address || '—' },
    { title: 'Viloyat ID', dataIndex: 'regionId', width: 110, render: (value: string | null) => value || '—' },
    { title: 'Tuman ID', dataIndex: 'districtId', width: 110, render: (value: string | null) => value || '—' },
    { title: 'Holati', dataIndex: 'isActive', width: 110, render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? 'Faol' : 'Nofaol'}</Tag> },
    { title: 'Default', dataIndex: 'isDefault', width: 150, render: (isDefault: boolean, warehouse) => isDefault ? <Tag color="gold" icon={<Star size={13} />}>Asosiy</Tag> : <Button type="link" loading={defaultMutation.isPending && defaultMutation.variables === warehouse.id} onClick={() => makeDefault(warehouse)}>Asosiy qilish</Button> },
  ];

  const submit = (values: WarehouseFormValues) => {
    createMutation.mutate({
      name: values.name.trim(),
      ...(values.regionId?.trim() ? { regionId: values.regionId.trim() } : {}),
      ...(values.districtId?.trim() ? { districtId: values.districtId.trim() } : {}),
      ...(values.address?.trim() ? { address: values.address.trim() } : {}),
      isDefault: values.isDefault === true,
    }, {
      onSuccess: () => { setOpen(false); void message.success('Ombor qo‘shildi'); },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  if (warehousesQuery.isPending) return <ContentState state="loading" />;
  if (warehousesQuery.isError) return <ContentState state="error" title="Omborlarni yuklab bo‘lmadi" description={getAuthErrorMessage(warehousesQuery.error)} onAction={() => void warehousesQuery.refetch()} />;

  return (
    <main>
      <PageHeader title="Omborlar" description="Mahsulot qoldiqlarini omborlar bo‘yicha boshqaring" extra={<Button type="primary" icon={<Plus />} onClick={() => setOpen(true)}>Ombor qo‘shish</Button>} />
      <Card>
        <DataTable rowKey="id" columns={columns} dataSource={warehousesQuery.data} scroll={{ x: 850 }} search={{ placeholder: 'Ombor yoki manzil qidirish...', filter: (warehouse, query) => `${warehouse.name} ${warehouse.address ?? ''}`.toLocaleLowerCase('uz').includes(query) }} />
      </Card>
      <FormModal title="Yangi ombor" open={open} form={form} initialValues={{ isDefault: warehousesQuery.data.length === 0 }} submitText="Qo‘shish" loading={createMutation.isPending} onCancel={() => setOpen(false)} onSubmit={submit}>
        <Form.Item label="Ombor nomi" name="name" rules={[{ required: true, whitespace: true, message: 'Ombor nomini kiriting' }, { max: 120 }]}><TextControl prefix={<MapPin size={16} />} placeholder="Masalan, Asosiy ombor" maxLength={120} /></Form.Item>
        <Form.Item label="Viloyat ID" name="regionId" rules={[{ max: 40 }]}><TextControl placeholder="Masalan, 12" maxLength={40} /></Form.Item>
        <Form.Item label="Tuman ID" name="districtId" rules={[{ max: 40 }]}><TextControl placeholder="Masalan, 140" maxLength={40} /></Form.Item>
        <Form.Item label="Manzil" name="address" rules={[{ max: 240 }]}><TextControl placeholder="Toshkent shahri, Chilonzor tumani" maxLength={240} /></Form.Item>
        <Form.Item label="Asosiy ombor" name="isDefault" valuePropName="checked"><Switch checkedChildren="Ha" unCheckedChildren="Yo‘q" /></Form.Item>
      </FormModal>
    </main>
  );
}
