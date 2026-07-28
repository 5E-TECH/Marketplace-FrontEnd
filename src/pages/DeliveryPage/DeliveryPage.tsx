import { CarOutlined, CheckCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Card, Col, Row, Steps, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { orders } from '../../features/seller/model/sellerData';
import type { Order } from '../../features/seller/model/sellerTypes';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';

export default function DeliveryPage() {
  const deliveryOrders = orders.filter(({ status }) =>
    ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(status),
  );
  const columns: ColumnsType<Order> = [
    { title: 'Buyurtma', dataIndex: 'id' },
    { title: 'Qabul qiluvchi', dataIndex: 'customer' },
    { title: 'Telefon', dataIndex: 'phone' },
    { title: 'Holati', dataIndex: 'status', render: (value: Order['status']) => <StatusTag status={value} /> },
  ];

  return (
    <>
      <PageHeader title="Yetkazib berish" description="Jo‘natmalar va yetkazish jarayonini kuzating" />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card title="Yetkazish jarayoni">
            <Steps
              direction="vertical"
              current={1}
              items={[
                { title: 'Buyurtma tayyor', description: 'Omborda qadoqlandi', icon: <CheckCircleOutlined /> },
                { title: 'Kuryer yo‘lda', description: 'Taxminiy vaqt: 35 daqiqa', icon: <CarOutlined /> },
                { title: 'Yetkaziladi', description: 'Mijoz manzili', icon: <EnvironmentOutlined /> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={15}>
          <Card title="Faol jo‘natmalar">
            <Table rowKey="id" columns={columns} dataSource={deliveryOrders} pagination={{ pageSize: 20, showSizeChanger: false }} scroll={{ x: 600 }} />
            <Typography.Text type="secondary">Yetkazish ma’lumotlari buyurtma holati yangilanganda avtomatik o‘zgaradi.</Typography.Text>
          </Card>
        </Col>
      </Row>
    </>
  );
}
