import { LockOutlined, LogoutOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Form, Input, Row, Space, Tabs, Typography } from 'antd';
import { useAppSelector } from '../../app/store/hooks';
import { useLogoutMutation } from '../../features/auth/api/useLogoutMutation';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';

export default function SettingsPage() {
  const { message, modal } = App.useApp();
  const user = useAppSelector(selectAuthUser);
  const logoutMutation = useLogoutMutation();

  return (
    <>
      <PageHeader title="Sozlamalar" description="Profil, xavfsizlik va sessiyani boshqaring" />
      <Card>
        <Tabs
          items={[
            {
              key: 'profile',
              label: <Space><UserOutlined />Profil</Space>,
              children: (
                <Form
                  layout="vertical"
                  requiredMark
                  initialValues={{ name: user?.name, phone: user?.phone, email: user?.email }}
                  onFinish={() => void message.success('Profil ma’lumotlari saqlandi')}
                >
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Ism" name="name" rules={[{ required: true, message: 'Ismingizni kiriting' }]}><Input /></Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Telefon" name="phone"><Input disabled /></Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="Email" name="email" rules={[{ type: 'email', message: 'Email formatini tekshiring' }]}><Input /></Form.Item>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Saqlash</Button>
                </Form>
              ),
            },
            {
              key: 'security',
              label: <Space><LockOutlined />Xavfsizlik</Space>,
              children: (
                <Form
                  layout="vertical"
                  requiredMark
                  onFinish={() => void message.success('Parol yangilandi')}
                >
                  <Form.Item label="Joriy parol" name="currentPassword" rules={[{ required: true, message: 'Joriy parolni kiriting' }]}><Input.Password /></Form.Item>
                  <Form.Item label="Yangi parol" name="newPassword" rules={[{ required: true, min: 8, message: 'Kamida 8 ta belgi kiriting' }]}><Input.Password /></Form.Item>
                  <Button type="primary" htmlType="submit">Parolni yangilash</Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Typography.Title level={3}>Sessiya</Typography.Title>
        <Typography.Paragraph type="secondary">Ushbu qurilmadagi sessiyani xavfsiz yakunlang.</Typography.Paragraph>
        <Button
          danger
          icon={<LogoutOutlined />}
          onClick={() => {
            void modal.confirm({
              title: 'Tizimdan chiqasizmi?',
              content: 'Joriy sessiya yakunlanadi.',
              okText: 'Chiqish',
              cancelText: 'Bekor',
              okButtonProps: { danger: true },
              onOk: () => logoutMutation.mutate(),
            });
          }}
        >
          Tizimdan chiqish
        </Button>
      </Card>
    </>
  );
}
