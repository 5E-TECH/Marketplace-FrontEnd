import { Eye as EyeOutlined } from 'lucide-react';
import { Button, Card, Descriptions, Drawer, Input, Select, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { formatPrice, orders } from '../../features/seller/model/sellerData';
import type { Order } from '../../features/seller/model/sellerTypes';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';

export default function OrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (status === 'ALL' || order.status === status) &&
          `${order.id} ${order.customer}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, status],
  );

  const columns: ColumnsType<Order> = [
    { title: 'Buyurtma', dataIndex: 'id', sorter: (a, b) => a.id.localeCompare(b.id) },
    { title: 'Mijoz', dataIndex: 'customer' },
    { title: 'Telefon', dataIndex: 'phone' },
    { title: 'Sana', dataIndex: 'createdAt' },
    { title: 'Summa', dataIndex: 'total', render: formatPrice, sorter: (a, b) => a.total - b.total },
    { title: 'Holati', dataIndex: 'status', render: (value: Order['status']) => <StatusTag status={value} /> },
    { title: '', width: 48, render: (_, order) => <Button type="text" icon={<EyeOutlined />} aria-label="Buyurtmani ko‘rish" onClick={() => setSelectedOrder(order)} /> },
  ];

  return (
    <>
      <PageHeader title="Buyurtmalar" description="Buyurtmalarni qabul qiling va holatini kuzating" />
      <Card>
        <Space wrap size={12} style={{ marginBottom: 16 }}>
          <Input.Search placeholder="Buyurtma yoki mijoz" allowClear onChange={(event) => setSearch(event.target.value)} />
          <Select
            value={status}
            style={{ width: 180 }}
            onChange={setStatus}
            options={[
              { value: 'ALL', label: 'Barcha holatlar' },
              { value: 'NEW', label: 'Yangi' },
              { value: 'PROCESSING', label: 'Tayyorlanmoqda' },
              { value: 'SHIPPED', label: 'Yo‘lda' },
              { value: 'DELIVERED', label: 'Yetkazildi' },
            ]}
          />
        </Space>
        <Table rowKey="id" columns={columns} dataSource={filteredOrders} scroll={{ x: 900 }} pagination={{ pageSize: 20, showSizeChanger: false }} />
      </Card>
      <Drawer title={`Buyurtma ${selectedOrder?.id ?? ''}`} width={420} open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)}>
        {selectedOrder ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Mijoz">{selectedOrder.customer}</Descriptions.Item>
            <Descriptions.Item label="Telefon">{selectedOrder.phone}</Descriptions.Item>
            <Descriptions.Item label="Sana">{selectedOrder.createdAt}</Descriptions.Item>
            <Descriptions.Item label="Summa">{formatPrice(selectedOrder.total)}</Descriptions.Item>
            <Descriptions.Item label="Holati"><StatusTag status={selectedOrder.status} /></Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </>
  );
}
