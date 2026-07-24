import { LockFilled } from '@ant-design/icons';
import { App, Card, Typography } from 'antd';
import { LoginBrand } from './components/LoginBrand/LoginBrand';
import {
  LoginForm,
  type LoginFormValues,
} from './components/LoginForm/LoginForm';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { message } = App.useApp();

  const handleSubmit = (values: LoginFormValues) => {
    const phone = `+998${values.phone}`;

    void message.info(
      `Server ishga tushgach ${phone} uchun kirish faollashadi.`,
    );
  };

  return (
    <main className={styles.page}>
      <section className={styles.auth} aria-labelledby="login-title">
        <Card className={styles.card} variant="borderless">
          <div className={styles.cardContent}>
            <LoginBrand />

            <LoginForm
              isSubmitting={false}
              onSubmit={handleSubmit}
            />

            <Typography.Text className={styles.security}>
              <LockFilled aria-hidden /> Hammasi shifrlangan va xavfsiz
            </Typography.Text>
          </div>
        </Card>
      </section>
    </main>
  );
}
