import { Button, Card, Form } from 'antd';
import type { FormInstance } from 'antd';
import { Save } from 'lucide-react';
import { PasswordInput } from '../../../shared/ui/PasswordInput/PasswordInput';
import { TextControl } from '../../../shared/ui/FormControls/FormControls';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from './UserForm.module.css';
export interface UserFormValues { name: string; phone: string; password: string; confirmPassword: string }
interface Props { form: FormInstance<UserFormValues>; loading: boolean; onSubmit: (values: UserFormValues) => void }

export function UserForm({ form, loading, onSubmit }: Props) {
  const { t } = useTranslation();
  return <Card className={styles.card}>
    <Form<UserFormValues> className={styles.form} form={form} layout="vertical" disabled={loading} onFinish={onSubmit}>
      <Form.Item label={t('users.name')} name="name" rules={[{ required: true, whitespace: true, message: t('users.nameRequired') }, { max: 255 }]}><TextControl maxLength={255} autoComplete="name" /></Form.Item>
      <Form.Item label={t('users.phone')} name="phone" rules={[{ required: true, message: t('users.phoneRequired') }, { pattern: /^\+998\d{9}$/, message: t('users.phoneInvalid') }]}><TextControl placeholder="+998901234567" autoComplete="tel" /></Form.Item>
      <Form.Item label={t('users.role')}><TextControl value="OPERATOR" disabled /></Form.Item>
      <Form.Item label={t('users.password')} name="password" rules={[{ required: true, message: t('users.passwordRequired') }, { min: 4, message: t('users.passwordMin') }]}><PasswordInput autoComplete="new-password" /></Form.Item>
      <Form.Item label={t('users.confirmPassword')} name="confirmPassword" dependencies={['password']} rules={[({ getFieldValue }) => ({ validator: (_, value: string | undefined) => { const password = getFieldValue('password') as string | undefined; return (!password && !value) || value === password ? Promise.resolve() : Promise.reject(new Error(t('users.passwordMismatch'))); } })]}><PasswordInput autoComplete="new-password" /></Form.Item>
      <div className={styles.actions}><Button type="primary" htmlType="submit" icon={<Save size={17} />} loading={loading}>{t('users.create')}</Button></div>
    </Form>
  </Card>;
}
