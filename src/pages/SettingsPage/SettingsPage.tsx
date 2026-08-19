import { LockKeyhole as LockOutlined } from 'lucide-react';
import { App, Button, Card, Form } from 'antd';
import { PasswordInput } from '../../shared/ui/PasswordInput/PasswordInput';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './SettingsPage.module.css';

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
}

export default function SettingsPage() {
  const { message } = App.useApp();

  return (
    <>
      <PageHeader
        title="Sozlamalar"
        description="Akkaunt xavfsizligi sozlamalarini boshqaring"
      />
      <Card className={styles.settingsCard} title={<><LockOutlined /> Xavfsizlik</>}>
        <Form<PasswordFormValues>
          className={styles.securityForm}
          layout="vertical"
          requiredMark
          onFinish={() =>
            void message.info('Parolni yangilash API’i hali taqdim etilmagan')
          }
        >
          <Form.Item
            label="Joriy parol"
            name="currentPassword"
            rules={[{ required: true, message: 'Joriy parolni kiriting' }]}
          >
            <PasswordInput autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="Yangi parol"
            name="newPassword"
            rules={[{ required: true, min: 4, message: 'Kamida 4 ta belgi kiriting' }]}
          >
            <PasswordInput autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Parolni yangilash
          </Button>
        </Form>
      </Card>
    </>
  );
}
