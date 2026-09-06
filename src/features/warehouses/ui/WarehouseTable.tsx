import { Pencil, Star, Trash2 } from 'lucide-react';
import { Button, Card, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Warehouse } from '../model/warehouseTypes';
import { DataTable } from '../../../shared/ui/DataTable/DataTable';
import { useTranslation } from '../../../shared/i18n/useTranslation';

interface WarehouseTableProps {
  warehouses: Warehouse[];
  changingDefaultId?: string;
  onMakeDefault: (warehouse: Warehouse) => void;
  onEdit: (warehouse: Warehouse) => void;
  onDelete: (warehouse: Warehouse) => void;
}

export function WarehouseTable({ warehouses, changingDefaultId, onMakeDefault, onEdit, onDelete }: WarehouseTableProps) {
  const { language, t } = useTranslation();
  const changingDefault = changingDefaultId !== undefined;
  const columns: ColumnsType<Warehouse> = [
    { title: t('warehouse.name'), dataIndex: 'name', render: (name: string) => <Typography.Text strong>{name}</Typography.Text> },
    { title: t('warehouse.address'), dataIndex: 'address', render: (address: string | null) => address || '—' },
    { title: t('warehouse.region'), dataIndex: 'regionId', width: 110, responsive: ['lg'], render: (value: string | null) => value || '—' },
    { title: t('warehouse.district'), dataIndex: 'districtId', width: 110, responsive: ['xl'], render: (value: string | null) => value || '—' },
    { title: t('warehouse.status'), dataIndex: 'isActive', width: 110, responsive: ['md'], render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? t('warehouse.active') : t('warehouse.inactive')}</Tag> },
    {
      title: t('warehouse.defaultColumn'), dataIndex: 'isDefault', width: 150,
      render: (isDefault: boolean, warehouse) => isDefault
        ? <Tag color="gold" icon={<Star size={13} />}>{t('warehouse.default')}</Tag>
        : <Button type="link" disabled={changingDefault} loading={changingDefaultId === warehouse.id} onClick={() => onMakeDefault(warehouse)}>{t('warehouse.makeDefault')}</Button>,
    },
    { title: t('users.actions'), width: 100, render: (_, warehouse) => <span><Button type="text" icon={<Pencil size={16} />} aria-label={`${warehouse.name} omborini tahrirlash`} onClick={() => onEdit(warehouse)} /><Button type="text" danger icon={<Trash2 size={16} />} aria-label={`${warehouse.name} omborini o‘chirish`} onClick={() => onDelete(warehouse)} /></span> },
  ];

  return <Card><DataTable rowKey="id" columns={columns} dataSource={warehouses} tableLayout="auto" search={{ placeholder: t('warehouse.search'), filter: (warehouse, query) => `${warehouse.name} ${warehouse.address ?? ''}`.toLocaleLowerCase(language).includes(query) }} /></Card>;
}
