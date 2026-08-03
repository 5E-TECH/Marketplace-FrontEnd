import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { warehouses as initialWarehouses } from '../../features/seller/model/sellerData';
import type { Warehouse } from '../../features/seller/model/sellerTypes';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { FormModal } from '../../shared/ui/FormModal/FormModal';

export default function WarehousesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<Pick<Warehouse, 'name' | 'address'>>();
  const [warehouses, setWarehouses] = useState(initialWarehouses);
  const [open, setOpen] = useState(false);

  const columns: ColumnsType<Warehouse> = [
    { title: 'Ombor', dataIndex: 'name' },
    { title: 'Manzil', dataIndex: 'address' },
    { title: 'Mahsulotlar', dataIndex: 'products', sorter: (a, b) => a.products - b.products },
    { title: 'Jami qoldiq', dataIndex: 'stock', sorter: (a, b) => a.stock - b.stock },
    { title: 'Holati', dataIndex: 'status', render: (status: Warehouse['status']) => <StatusTag status={status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Omborlar"
        description="Mahsulot qoldiqlarini filiallar bo‘yicha boshqaring"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Ombor qo‘shish</Button>}
      />
      <Card>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={warehouses}
          scroll={{ x: 760 }}
          search={{
            placeholder: 'Ombor yoki manzil qidirish...',
            filter: (warehouse, query) =>
              `${warehouse.name} ${warehouse.address}`
                .toLocaleLowerCase('uz')
                .includes(query),
          }}
        />
      </Card>
      <FormModal
        title="Yangi ombor"
        open={open}
        form={form}
        submitText="Qo‘shish"
        onCancel={() => setOpen(false)}
        onSubmit={(values) => {
            setWarehouses((items) => [...items, { ...values, id: crypto.randomUUID(), products: 0, stock: 0, status: 'ACTIVE' }]);
            setOpen(false);
            void message.success('Ombor qo‘shildi');
        }}
      >
        <Form.Item label="Ombor nomi" name="name" rules={[{ required: true, message: 'Ombor nomini kiriting' }]}><Input /></Form.Item>
        <Form.Item label="Manzil" name="address" rules={[{ required: true, message: 'Manzilni kiriting' }]}><Input /></Form.Item>
      </FormModal>
    </>
  );
}
