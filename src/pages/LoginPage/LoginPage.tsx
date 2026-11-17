import { App, Form } from 'antd';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../../features/auth/api/useLoginMutation';
import { authStorage } from '../../features/auth/lib/authStorage';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { BRAND } from '../../shared/config/brand';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { normalizeUzPhone } from '../../shared/lib/phone';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher/LanguageSwitcher';
import { LoginForm, type LoginFormValues, type LoginNotice } from './components/LoginForm/LoginForm';
import { LoginMethods } from './components/LoginMethods/LoginMethods';
import styles from './LoginPage.module.css';

const BRAND_ICON = '/brand/elchi-app-icon.png';

/**
 * Tizimga kirish (umumiy-kirish, FE-01). Desktop: chapda navy «Kirish usuli»,
 * o'ngda forma; telefon: navy sarlavha, forma, ostida usullar. Hozircha faqat
 * platforma xodimi formasi — sotuvchi SMS kodi FE-04 (BE-06) bilan qo'shiladi.
 */
export default function LoginPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const [form] = Form.useForm<LoginFormValues>();
  const [notice, setNotice] = useState<LoginNotice | null>(null);
  const phone = useMediaQuery('(max-width: 767.98px)');

  useEffect(() => {
    const state: unknown = location.state as unknown;
    const locationNotice = typeof state === 'object' && state !== null && 'notice' in state && typeof state.notice === 'string'
      ? state.notice
      : null;
    const pendingNotice = locationNotice ?? authStorage.consumeNotice();
    if (pendingNotice) {
      void message.success(pendingNotice);
      if (locationNotice) void navigate('/login', { replace: true, state: null });
    }
  }, [location.state, message, navigate]);

  const showError = (error: unknown) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    // Parol xato yoki raqam ro'yxatda yo'q — bir xil matn: hisob borligi oshkor qilinmaydi.
    if (status === 401) {
      form.setFields([{ name: 'password', errors: [t('login.invalidCredentials')] }]);
      return;
    }
    if (status === 429) {
      setNotice({ tone: 'warning', title: t('login.tooManyTitle'), text: t('login.tooManyText') });
      return;
    }
    if (status === undefined || status >= 500) {
      setNotice({ tone: 'danger', title: t('login.serverTitle'), text: t('login.serverText') });
      return;
    }
    setNotice({ tone: 'danger', title: t('login.failedTitle'), text: getApiErrorMessage(error) });
  };

  const handleSubmit = (values: LoginFormValues) => {
    setNotice(null);
    loginMutation.mutate(
      { phone: normalizeUzPhone(values.phone), password: values.password },
      {
        onSuccess: () => void message.success(t('auth.loginSuccess')),
        onError: showError,
      },
    );
  };

  const formBlock = (
    <LoginForm
      form={form}
      isSubmitting={loginMutation.isPending}
      notice={notice}
      onSubmit={handleSubmit}
      onChange={() => setNotice(null)}
    />
  );

  if (phone) {
    return (
      <div className={styles.phonePage}>
        <header className={styles.phoneHeader}>
          <span className={styles.brand}>
            <img src={BRAND_ICON} alt="" width={32} height={32} />
            <span>{BRAND.name}</span>
          </span>
          <LanguageSwitcher className={styles.navyLanguage} />
        </header>
        <main className={styles.phoneMain}>{formBlock}</main>
        <LoginMethods tone="light" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <LoginMethods
        tone="navy"
        brand={
          <span className={`${styles.brand} ${styles.asideBrand}`}>
            <img src={BRAND_ICON} alt="" width={36} height={36} />
            <span>{BRAND.name}</span>
          </span>
        }
      />
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <LanguageSwitcher />
        </div>
        <div className={styles.center}>{formBlock}</div>
      </main>
    </div>
  );
}
