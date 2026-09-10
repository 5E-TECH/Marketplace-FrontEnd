import { LockKeyhole as LockFilled } from 'lucide-react';
import { App, Card, Typography } from 'antd';
import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../../features/auth/api/useLoginMutation';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { LoginBrand } from './components/LoginBrand/LoginBrand';
import {
  LoginForm,
  type LoginFormValues,
} from './components/LoginForm/LoginForm';
import styles from './LoginPage.module.css';
import { authStorage } from '../../features/auth/lib/authStorage';
import { normalizeUzPhone } from '../../shared/lib/phone';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher/LanguageSwitcher';

export default function LoginPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();

  useEffect(() => {
    const state: unknown = location.state as unknown;
    const locationNotice = typeof state === 'object' && state !== null && 'notice' in state && typeof state.notice === 'string'
      ? state.notice
      : null;
    const notice = locationNotice ?? authStorage.consumeNotice();
    if (notice) {
      void message.success(notice);
      if (locationNotice) void navigate('/login', { replace: true, state: null });
    }
  }, [location.state, message, navigate]);

  const handleSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      {
        phone: normalizeUzPhone(values.phone),
        password: values.password,
      },
      {
        onSuccess: () => {
          void message.success(t('auth.loginSuccess'));
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
      <section className={styles.auth} aria-labelledby="login-title">
        <Card className={styles.card} variant="borderless">
          <div className={styles.cardContent}>
            <LoginBrand />

            <LoginForm
              isSubmitting={loginMutation.isPending}
              onSubmit={handleSubmit}
            />
            <Typography.Paragraph className={styles.switchAuth}><Link to="/forgot-password">{t('auth.forgotPassword')}</Link></Typography.Paragraph>
            <Typography.Paragraph className={styles.switchAuth}>{t('auth.noAccount')} <Link to="/register/account">{t('auth.register')}</Link></Typography.Paragraph>

            <Typography.Text className={styles.security}>
              <LockFilled aria-hidden /> {t('auth.securityNotice')}
            </Typography.Text>
          </div>
        </Card>
      </section>
    </main>
  );
}
