import { App, Button, Form } from 'antd';
import { Save, ShieldCheck, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCreateAdminUserMutation } from '../../features/adminUsers/api/adminUserQueries';
import { ADMIN_USER_ROLE_OPTIONS } from '../../features/adminUsers/model/adminUserOptions';
import type { AdminUserRole } from '../../features/adminUsers/model/adminUserTypes';
import { getApiFieldErrors, getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { BackButton } from '../../shared/ui/BackButton/BackButton';
import { TextControl, SelectControl } from '../../shared/ui/FormControls/FormControls';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { PasswordInput } from '../../shared/ui/PasswordInput/PasswordInput';
import { useTranslation } from '../../shared/i18n/useTranslation';
import styles from './AdminUserCreatePage.module.css';

interface AdminUserFormValues {
  name: string;
  phone: string;
  email?: string;
  role: AdminUserRole;
  password: string;
  confirmPassword: string;
}

const editableFields = new Set<keyof AdminUserFormValues>([
  'name', 'phone', 'email', 'role', 'password', 'confirmPassword',
]);

export default function AdminUserCreatePage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm<AdminUserFormValues>();
  const createMutation = useCreateAdminUserMutation();

  const submit = (values: AdminUserFormValues) => {
    createMutation.mutate(
      {
        name: values.name.trim(),
        phone: values.phone.replace(/\s/g, ''),
        ...(values.email?.trim() ? { email: values.email.trim() } : {}),
        role: values.role,
        password: values.password,
      },
      {
        onSuccess: () => {
          void message.success(t('admin.users.createdSuccess'));
          void navigate('/admin/users', { replace: true });
        },
        onError: (error) => {
          const fieldErrors = getApiFieldErrors(error).filter(({ name }) =>
            editableFields.has(name as keyof AdminUserFormValues),
          );
          if (fieldErrors.length) {
            form.setFields(fieldErrors.map(({ name, errors }) => ({ name: [name as keyof AdminUserFormValues], errors })));
          }
          void message.error(getAuthErrorMessage(error));
        },
      },
    );
  };

  return (
    <main className={styles.page}>
      <PageHeader
        before={<BackButton fallback="/admin/users" disabled={createMutation.isPending} />}
        title={t('admin.users.createTitle')}
        description={t('admin.users.createDescription')}
      />

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <span className={styles.headerIcon}><UserPlus aria-hidden /></span>
          <div>
            <h2>{t('admin.users.formTitle')}</h2>
            <p>{t('admin.users.formDescription')}</p>
          </div>
        </header>

        <Form<AdminUserFormValues>
          className={styles.form}
          form={form}
          layout="vertical"
          initialValues={{ role: 'BUYER' }}
          disabled={createMutation.isPending}
          onFinish={submit}
        >
          <Form.Item
            label={t('admin.users.fullName')}
            name="name"
            rules={[
              { required: true, whitespace: true, message: t('admin.users.nameRequired') },
              { min: 2, message: t('admin.users.nameMin') },
              { max: 255, message: t('admin.users.nameMax') },
            ]}
          >
            <TextControl placeholder={t('admin.users.namePlaceholder')} autoComplete="name" maxLength={255} />
          </Form.Item>

          <Form.Item
            label={t('admin.users.phone')}
            name="phone"
            rules={[
              { required: true, message: t('admin.users.phoneRequired') },
              { pattern: /^\+998\d{9}$/, message: t('admin.users.phoneInvalid') },
            ]}
          >
            <TextControl placeholder="+998901234567" autoComplete="tel" maxLength={13} />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { type: 'email', message: t('admin.users.emailInvalid') },
              { max: 255, message: t('admin.users.emailMax') },
            ]}
          >
            <TextControl placeholder="ali@example.com" autoComplete="email" maxLength={255} />
          </Form.Item>

          <Form.Item
            label={t('admin.users.role')}
            name="role"
            rules={[{ required: true, message: t('admin.users.roleRequired') }]}
          >
            <SelectControl options={ADMIN_USER_ROLE_OPTIONS.map(({ value, label }) => ({ value, label: t(label) }))} />
          </Form.Item>

          <div className={styles.sectionHeading}>
            <ShieldCheck aria-hidden />
            <div><strong>{t('admin.users.security')}</strong><span>{t('admin.users.securityDescription')}</span></div>
          </div>

          <Form.Item
            label={t('users.password')}
            name="password"
            rules={[
              { required: true, message: t('admin.users.passwordRequired') },
              { min: 8, message: t('admin.users.passwordMin') },
            ]}
          >
            <PasswordInput autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            label={t('admin.users.confirmPassword')}
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: t('admin.users.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator: (_, value: string | undefined) =>
                  !value || value === getFieldValue('password')
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('admin.users.passwordMismatch'))),
              }),
            ]}
          >
            <PasswordInput autoComplete="new-password" />
          </Form.Item>

          <div className={styles.actions}>
            <Button disabled={createMutation.isPending} onClick={() => void navigate('/admin/users')}>{t('common.cancel')}</Button>
            <Button type="primary" htmlType="submit" icon={<Save size={17} />} loading={createMutation.isPending}>
              {t('admin.users.create')}
            </Button>
          </div>
        </Form>
      </section>
    </main>
  );
}
