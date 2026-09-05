import { LockKeyhole as LockFilled } from 'lucide-react';
import { App, Card, Typography } from 'antd';
import { useLoginMutation } from '../../features/auth/api/useLoginMutation';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { LoginBrand } from './components/LoginBrand/LoginBrand';
import {
  LoginForm,
  type LoginFormValues,
} from './components/LoginForm/LoginForm';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { message } = App.useApp();
  const loginMutation = useLoginMutation();

  const handleSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      {
        phone: `+998${values.phone}`,
        password: values.password,
      },
      {
        onSuccess: () => {
          void message.success('Tizimga muvaffaqiyatli kirdingiz');
        },
        onError: (error) => {
          void message.error(getAuthErrorMessage(error));
        },
      },
    );
  };

  return (
    <main className={styles.page}>
      <section className={styles.auth} aria-labelledby="login-title">
        <Card className={styles.card} variant="borderless">
          <div className={styles.cardContent}>
            <LoginBrand />

            <LoginForm
              isSubmitting={loginMutation.isPending}
              onSubmit={handleSubmit}
            />

            <Typography.Text className={styles.security}>
              <LockFilled aria-hidden /> Parolingiz brauzer xotirasida saqlanmaydi
            </Typography.Text>
          </div>
        </Card>
      </section>
    </main>
  );
}
