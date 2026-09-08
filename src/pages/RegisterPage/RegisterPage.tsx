import { LockKeyhole as LockFilled } from 'lucide-react';
import { App, Card, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useRegisterMutation } from '../../features/auth/api/useRegisterMutation';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { LoginBrand } from '../LoginPage/components/LoginBrand/LoginBrand';
import styles from '../LoginPage/LoginPage.module.css';
import { normalizeUzPhone } from '../../shared/lib/phone';
import {
  RegisterForm,
  type RegisterFormValues,
} from './components/RegisterForm';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher/LanguageSwitcher';

export default function RegisterPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const registerMutation = useRegisterMutation();

  const handleSubmit = ({ name, phone, password, email, shopName, shopDescription, address }: RegisterFormValues) => {
    registerMutation.mutate(
      {
        name: name.trim(),
        phone: normalizeUzPhone(phone),
        password,
        shopName: shopName.trim(),
        ...(email?.trim() ? { email: email.trim() } : {}),
        ...(shopDescription?.trim() ? { shopDescription: shopDescription.trim() } : {}),
        ...(address?.trim() ? { address: address.trim() } : {}),
      },
      {
        onSuccess: () => {
          void message.success(t('auth.registrationSuccess'));
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
      <div className={styles.language}><LanguageSwitcher /></div>
      <section className={styles.auth} aria-labelledby="register-title">
        <Card className={styles.card} variant="borderless">
          <div className={styles.cardContent}>
            <LoginBrand titleId="register-title" />
            <RegisterForm
              isSubmitting={registerMutation.isPending}
              onSubmit={handleSubmit}
            />
            <Typography.Paragraph className={styles.switchAuth}>
              {t('auth.hasAccount')} <Link to="/login">{t('auth.login')}</Link>
            </Typography.Paragraph>
            <Typography.Text className={styles.security}>
              <LockFilled aria-hidden /> {t('auth.securityNotice')}
            </Typography.Text>
          </div>
        </Card>
      </section>
    </main>
  );
}
