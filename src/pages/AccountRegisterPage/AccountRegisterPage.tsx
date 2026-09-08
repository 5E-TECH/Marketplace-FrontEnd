import { App, Button, Form, Input } from 'antd';
import { UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRegisterAccountMutation } from '../../features/auth/api/authQueries';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PasswordInput } from '../../shared/ui/PasswordInput/PasswordInput';
import { AuthCard } from '../../shared/ui/AuthCard/AuthCard';
import { normalizeUzPhone, UZ_LOCAL_PHONE_PATTERN } from '../../shared/lib/phone';
import styles from '../AuthRecoveryPage/AuthRecoveryPage.module.css';
import { useTranslation } from '../../shared/i18n/useTranslation';

interface AccountRegisterValues {
  name: string;
  phone: string;
  email?: string;
  password: string;
}

export default function AccountRegisterPage() {
  const registerMutation = useRegisterAccountMutation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useTranslation();

  const submit = (values: AccountRegisterValues) => {
    const phone = normalizeUzPhone(values.phone);
    registerMutation.mutate(
      {
        name: values.name.trim(),
        phone,
        password: values.password,
        ...(values.email?.trim() ? { email: values.email.trim() } : {}),
        role: 'BUYER',
      },
      {
        onSuccess: () => {
          void message.success(t('auth.accountCreated'));
          void navigate('/verify-phone', { replace: true, state: { phone } });
        },
        onError: (error) => void message.error(getAuthErrorMessage(error)),
      },
    );
  };

  return <AuthCard title={t('auth.buyerAccount')} description={t('auth.buyerAccountDescription')} icon={<UserPlus />} backLabel={t('auth.backToLogin')}><Form<AccountRegisterValues> layout="vertical" className={styles.form} onFinish={submit}><Form.Item name="name" label={t('auth.name')} rules={[{ required: true, message: t('auth.fullNameRequired') }, { min: 2, message: t('auth.nameMin') }]}><Input autoComplete="name" /></Form.Item><Form.Item name="phone" label={t('auth.phone')} rules={[{ required: true, message: t('auth.phoneRequired') }, { pattern: UZ_LOCAL_PHONE_PATTERN, message: t('auth.phoneNineDigits') }]}><Input addonBefore="+998" inputMode="numeric" maxLength={9} /></Form.Item><Form.Item name="email" label={t('auth.emailOptional')} rules={[{ type: 'email', message: t('auth.emailInvalid') }]}><Input autoComplete="email" /></Form.Item><Form.Item name="password" label={t('auth.password')} rules={[{ required: true, message: t('auth.passwordRequired') }, { min: 8, message: t('auth.strongPassword') }]}><PasswordInput autoComplete="new-password" /></Form.Item><Button block type="primary" htmlType="submit" loading={registerMutation.isPending}>{t('auth.createAccount')}</Button></Form></AuthCard>;
}
