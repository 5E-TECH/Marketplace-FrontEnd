import { SaveOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Form, Input, Row, Select, Switch } from 'antd';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';

interface ShopFormValues {
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  workingDays: string[];
  acceptingOrders: boolean;
}

export default function ShopPage() {
  const { message } = App.useApp();

  return (
    <>
      <PageHeader title="Do‘kon sozlamalari" description="Mijozlarga ko‘rinadigan do‘kon ma’lumotlarini boshqaring" />
      <Card>
        <Form<ShopFormValues>
          layout="vertical"
          requiredMark
          initialValues={{
            name: 'MarketHub Store',
            description: 'Original va sifatli mahsulotlar do‘koni',
            phone: '+998 90 000 00 00',
            email: 'seller@markethub.uz',
            address: 'Toshkent shahri, Chilonzor tumani',
            workingDays: ['Dush–Jum', 'Shanba'],
            acceptingOrders: true,
          }}
          onFinish={() => void message.success('Do‘kon ma’lumotlari saqlandi')}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Do‘kon nomi" name="name" rules={[{ required: true, message: 'Do‘kon nomini kiriting' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Telefon" name="phone" rules={[{ required: true, message: 'Telefon raqamini kiriting' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Tavsif" name="description">
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Email" name="email" rules={[{ type: 'email', message: 'Email formatini tekshiring' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Ish kunlari" name="workingDays">
                <Select mode="multiple" options={['Dush–Jum', 'Shanba', 'Yakshanba'].map((value) => ({ label: value, value }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Manzil" name="address" rules={[{ required: true, message: 'Manzilni kiriting' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Buyurtmalarni qabul qilish" name="acceptingOrders" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Saqlash</Button>
        </Form>
      </Card>
    </>
  );
}
