import { Card, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useSellerOrdersQuery } from '../../features/orders/api/orderQueries';
import type { SellerOrder } from '../../features/orders/model/orderTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { ContentState } from '../../shared/ui/ContentState/ContentState';

const DELIVERY_STATUSES = new Set(['SHIPMENT_CREATED', 'ON_THE_ROAD', 'DELIVERED']);

export default function DeliveryPage() {
  const ordersQuery = useSellerOrdersQuery({ page: 1, limit: 100 });
  const deliveryOrders = (ordersQuery.data?.items ?? []).filter(({ status }) =>
    DELIVERY_STATUSES.has(status),
  );
  const columns: ColumnsType<SellerOrder> = [
    { title: 'Buyurtma', render: (_, order) => `#${order.salesOrderId}` },
    { title: 'Qabul qiluvchi', dataIndex: 'buyerName', render: (name: string | null) => name || 'Noma’lum' },
    { title: 'Tovarlar', dataIndex: 'itemsCount', render: (count: number) => `${count} ta` },
    { title: 'Jo‘natma ID', dataIndex: 'elchiShipmentId', render: (id: string | null) => id || '—' },
    { title: 'Holati', dataIndex: 'status', render: (value: SellerOrder['status']) => <StatusTag status={value} /> },
  ];

  if (ordersQuery.isPending) return <ContentState state="loading" />;
  if (ordersQuery.isError) return <ContentState state="error" title="Jo‘natmalarni yuklab bo‘lmadi" description={getAuthErrorMessage(ordersQuery.error)} onAction={() => void ordersQuery.refetch()} />;

  return (
    <>
      <PageHeader title="Yetkazib berish" description="Jo‘natmalar va yetkazish jarayonini kuzating" />
      <Card title="Jo‘natmalar">
        <Table rowKey="id" columns={columns} dataSource={deliveryOrders} pagination={{ pageSize: 20, showSizeChanger: false }} scroll={{ x: 720 }} locale={{ emptyText: 'Jo‘natmalar topilmadi' }} />
        <Typography.Text type="secondary">Ma’lumotlar seller buyurtmalari API’idan olinadi.</Typography.Text>
      </Card>
    </>
  );
}
