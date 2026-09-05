import { App, Button, Form, Input } from 'antd';
import { UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRegisterAccountMutation } from '../../features/auth/api/authQueries';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PasswordInput } from '../../shared/ui/PasswordInput/PasswordInput';
import { AuthCard } from '../../shared/ui/AuthCard/AuthCard';
import { normalizeUzPhone, UZ_LOCAL_PHONE_PATTERN } from '../../shared/lib/phone';
import styles from '../AuthRecoveryPage/AuthRecoveryPage.module.css';

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
          void message.success('Akkaunt yaratildi. Telefon raqamingizni tasdiqlang.');
          void navigate('/verify-phone', { replace: true, state: { phone } });
        },
        onError: (error) => void message.error(getAuthErrorMessage(error)),
      },
    );
  };

  return <AuthCard title="Xaridor akkaunti" description="Marketplace’da xarid qilish uchun yangi akkaunt yarating." icon={<UserPlus />} backLabel="Kirishga qaytish"><Form<AccountRegisterValues> layout="vertical" className={styles.form} onFinish={submit}><Form.Item name="name" label="Ism" rules={[{ required: true }, { min: 2 }]}><Input autoComplete="name" /></Form.Item><Form.Item name="phone" label="Telefon raqami" rules={[{ required: true }, { pattern: UZ_LOCAL_PHONE_PATTERN, message: '9 ta raqam kiriting' }]}><Input addonBefore="+998" inputMode="numeric" maxLength={9} /></Form.Item><Form.Item name="email" label="Email (ixtiyoriy)" rules={[{ type: 'email' }]}><Input autoComplete="email" /></Form.Item><Form.Item name="password" label="Parol" rules={[{ required: true }, { min: 8 }]}><PasswordInput autoComplete="new-password" /></Form.Item><Button block type="primary" htmlType="submit" loading={registerMutation.isPending}>Akkaunt yaratish</Button></Form></AuthCard>;
}
