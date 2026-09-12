import { Headphones as CustomerServiceOutlined, MessageCircle as MessageOutlined } from 'lucide-react';
import { Button, Card, Col, Row, Typography } from 'antd';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';

export default function SupportPage() {
  return (
    <>
      <PageHeader
        title="Yordam markazi"
        description="Savollaringizga tezkor javob oling"
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card>
            <CustomerServiceOutlined style={{ fontSize: 24, color: 'var(--color-support)' }} />
            <Typography.Title level={3}>Operator bilan bog‘lanish</Typography.Title>
            <Typography.Paragraph type="secondary">
              Ish kunlari 09:00–18:00 oralig‘ida yordam beramiz.
            </Typography.Paragraph>
            <Button type="primary" disabled title="Aloqa raqami hali sozlanmagan">Qo‘ng‘iroq qilish</Button>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card>
            <MessageOutlined style={{ fontSize: 24, color: 'var(--color-success)' }} />
            <Typography.Title level={3}>Yordam chatini ochish</Typography.Title>
            <Typography.Paragraph type="secondary">
              Muammoni yozib qoldiring, mutaxassis javob beradi.
            </Typography.Paragraph>
            <Button disabled title="Yordam chati hali ulanmagan">Chatni boshlash</Button>
          </Card>
        </Col>
      </Row>
    </>
  );
}
