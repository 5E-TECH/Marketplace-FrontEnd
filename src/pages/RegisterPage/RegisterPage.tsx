import { LockKeyhole as LockFilled } from 'lucide-react';
import { App, Card, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useRegisterMutation } from '../../features/auth/api/useRegisterMutation';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { LoginBrand } from '../LoginPage/components/LoginBrand/LoginBrand';
import styles from '../LoginPage/LoginPage.module.css';
import {
  RegisterForm,
  type RegisterFormValues,
} from './components/RegisterForm';

export default function RegisterPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const registerMutation = useRegisterMutation();

  const handleSubmit = ({ name, phone, password }: RegisterFormValues) => {
    registerMutation.mutate(
      { name: name.trim(), phone: `+998${phone}`, password },
      {
        onSuccess: () => {
          void message.success('Ro‘yxatdan muvaffaqiyatli o‘tdingiz');
          void navigate('/login', { replace: true });
        },
        onError: (error) => {
          void message.error(getAuthErrorMessage(error));
        },
      },
    );
  };

  return (
    <main className={styles.page}>
      <section className={styles.auth} aria-labelledby="register-title">
        <Card className={styles.card} variant="borderless">
          <div className={styles.cardContent}>
            <LoginBrand titleId="register-title" />
            <RegisterForm
              isSubmitting={registerMutation.isPending}
              onSubmit={handleSubmit}
            />
            <Typography.Paragraph className={styles.switchAuth}>
              Akkauntingiz bormi? <Link to="/login">Kirish</Link>
            </Typography.Paragraph>
            <Typography.Text className={styles.security}>
              <LockFilled aria-hidden /> Parolingiz brauzer xotirasida saqlanmaydi
            </Typography.Text>
          </div>
        </Card>
      </section>
    </main>
  );
}
