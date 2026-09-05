import { App, Button, Form, Input } from 'antd';
import { KeyRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForgotPasswordMutation, useResendCodeMutation, useResetPasswordMutation, useVerifyPhoneMutation } from '../../features/auth/api/authQueries';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PasswordInput } from '../../shared/ui/PasswordInput/PasswordInput';
import { AuthCard } from '../../shared/ui/AuthCard/AuthCard';
import { getUzLocalPhone, normalizeUzPhone } from '../../shared/lib/phone';
import styles from './AuthRecoveryPage.module.css';

interface Values { phone: string; code?: string; newPassword?: string }
export default function AuthRecoveryPage() {
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const locationState = location.state as { phone?: unknown } | null;
  const initialPhone = typeof locationState?.phone === 'string'
    ? getUzLocalPhone(locationState.phone)
    : '';
  const forgot = useForgotPasswordMutation(); const reset = useResetPasswordMutation(); const verify = useVerifyPhoneMutation(); const resend = useResendCodeMutation();
  const mode = pathname.includes('reset-password') ? 'reset' : pathname.includes('verify-phone') ? 'verify' : 'forgot';
  const mutation = mode === 'reset' ? reset : mode === 'verify' ? verify : forgot;
  const submit = (values: Values) => { const phone = normalizeUzPhone(values.phone); const callbacks = { onSuccess: () => { void message.success(mode === 'forgot' ? 'Tasdiqlash kodi yuborildi' : mode === 'reset' ? 'Parol yangilandi' : 'Telefon tasdiqlandi'); void navigate(mode === 'forgot' ? '/reset-password' : '/login', { replace: true, state: mode === 'forgot' ? { phone } : undefined }); }, onError: (error: Error) => void message.error(getAuthErrorMessage(error)) }; if (mode === 'forgot') forgot.mutate({ phone }, callbacks); else if (mode === 'verify' && values.code) verify.mutate({ phone, code: values.code }, callbacks); else if (values.code && values.newPassword) reset.mutate({ phone, code: values.code, newPassword: values.newPassword }, callbacks); };
  const title = mode === 'forgot' ? 'Parolni tiklash' : mode === 'reset' ? 'Yangi parol' : 'Telefonni tasdiqlash';
  const description = mode === 'forgot' ? 'Telefon raqamingizga tasdiqlash kodi yuboramiz.' : 'Telefon raqami va SMS kodni kiriting.';
  return <AuthCard title={title} description={description} icon={<KeyRound />}><Form<Values> form={form} layout="vertical" initialValues={{ phone: initialPhone }} onFinish={submit} className={styles.form}><Form.Item name="phone" label="Telefon raqami" rules={[{ required: true }]}><Input addonBefore="+998" inputMode="numeric" placeholder="901234567" /></Form.Item>{mode !== 'forgot' ? <Form.Item name="code" label="Tasdiqlash kodi" rules={[{ required: true }, { len: 6 }]}><Input inputMode="numeric" maxLength={6} /></Form.Item> : null}{mode === 'reset' ? <Form.Item name="newPassword" label="Yangi parol" rules={[{ required: true }, { min: 8 }]}><PasswordInput autoComplete="new-password" /></Form.Item> : null}<Button block type="primary" htmlType="submit" loading={mutation.isPending}>{mode === 'forgot' ? 'Kod yuborish' : mode === 'reset' ? 'Parolni yangilash' : 'Tasdiqlash'}</Button>{mode !== 'forgot' ? <Button block type="link" loading={resend.isPending} onClick={() => { const raw: unknown = form.getFieldValue('phone'); if (typeof raw !== 'string' || !raw.trim()) { void form.validateFields(['phone']); return; } resend.mutate({ phone: normalizeUzPhone(raw) }, { onSuccess: () => void message.success('Kod qayta yuborildi'), onError: (error) => void message.error(getAuthErrorMessage(error)) }); }}>Kodni qayta yuborish</Button> : null}</Form></AuthCard>;
}
