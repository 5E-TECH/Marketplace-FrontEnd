import { Star } from 'lucide-react';
import { Button, Card, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Warehouse } from '../model/warehouseTypes';
import { DataTable } from '../../../shared/ui/DataTable/DataTable';

interface WarehouseTableProps {
  warehouses: Warehouse[];
  changingDefaultId?: string;
  onMakeDefault: (warehouse: Warehouse) => void;
}

export function WarehouseTable({ warehouses, changingDefaultId, onMakeDefault }: WarehouseTableProps) {
  const changingDefault = changingDefaultId !== undefined;
  const columns: ColumnsType<Warehouse> = [
    { title: 'Ombor', dataIndex: 'name', render: (name: string) => <Typography.Text strong>{name}</Typography.Text> },
    { title: 'Manzil', dataIndex: 'address', render: (address: string | null) => address || '—' },
    { title: 'Viloyat ID', dataIndex: 'regionId', width: 110, render: (value: string | null) => value || '—' },
    { title: 'Tuman ID', dataIndex: 'districtId', width: 110, render: (value: string | null) => value || '—' },
    { title: 'Holati', dataIndex: 'isActive', width: 110, render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? 'Faol' : 'Nofaol'}</Tag> },
    {
      title: 'Default', dataIndex: 'isDefault', width: 150,
      render: (isDefault: boolean, warehouse) => isDefault
        ? <Tag color="gold" icon={<Star size={13} />}>Asosiy</Tag>
        : <Button type="link" disabled={changingDefault} loading={changingDefaultId === warehouse.id} onClick={() => onMakeDefault(warehouse)}>Asosiy qilish</Button>,
    },
  ];

  return <Card><DataTable rowKey="id" columns={columns} dataSource={warehouses} scroll={{ x: 850 }} search={{ placeholder: 'Ombor yoki manzil qidirish...', filter: (warehouse, query) => `${warehouse.name} ${warehouse.address ?? ''}`.toLocaleLowerCase('uz').includes(query) }} /></Card>;
}
