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
          void message.success('Foydalanuvchi muvaffaqiyatli yaratildi');
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
        title="Yangi foydalanuvchi"
        description="Akkaunt ma’lumotlari va platformadagi rolini belgilang"
      />

      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <span className={styles.headerIcon}><UserPlus aria-hidden /></span>
          <div>
            <h2>Foydalanuvchi ma’lumotlari</h2>
            <p>Barcha majburiy maydonlarni to‘ldiring</p>
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
            label="To‘liq ism"
            name="name"
            rules={[
              { required: true, whitespace: true, message: 'Foydalanuvchi ismini kiriting' },
              { min: 2, message: 'Ism kamida 2 ta belgidan iborat bo‘lsin' },
              { max: 255, message: 'Ism 255 belgidan oshmasligi kerak' },
            ]}
          >
            <TextControl placeholder="Masalan: Ali Valiyev" autoComplete="name" maxLength={255} />
          </Form.Item>

          <Form.Item
            label="Telefon raqami"
            name="phone"
            rules={[
              { required: true, message: 'Telefon raqamini kiriting' },
              { pattern: /^\+998\d{9}$/, message: '+998901234567 formatida kiriting' },
            ]}
          >
            <TextControl placeholder="+998901234567" autoComplete="tel" maxLength={13} />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { type: 'email', message: 'Email manzilini to‘g‘ri kiriting' },
              { max: 255, message: 'Email 255 belgidan oshmasligi kerak' },
            ]}
          >
            <TextControl placeholder="ali@example.com" autoComplete="email" maxLength={255} />
          </Form.Item>

          <Form.Item
            label="Foydalanuvchi roli"
            name="role"
            rules={[{ required: true, message: 'Rolni tanlang' }]}
          >
            <SelectControl options={ADMIN_USER_ROLE_OPTIONS} />
          </Form.Item>

          <div className={styles.sectionHeading}>
            <ShieldCheck aria-hidden />
            <div><strong>Kirish xavfsizligi</strong><span>Foydalanuvchi tizimga shu parol bilan kiradi</span></div>
          </div>

          <Form.Item
            label="Parol"
            name="password"
            rules={[
              { required: true, message: 'Parolni kiriting' },
              { min: 8, message: 'Parol kamida 8 ta belgidan iborat bo‘lsin' },
            ]}
          >
            <PasswordInput autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            label="Parolni tasdiqlash"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Parolni qayta kiriting' },
              ({ getFieldValue }) => ({
                validator: (_, value: string | undefined) =>
                  !value || value === getFieldValue('password')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Parollar bir xil emas')),
              }),
            ]}
          >
            <PasswordInput autoComplete="new-password" />
          </Form.Item>

          <div className={styles.actions}>
            <Button disabled={createMutation.isPending} onClick={() => void navigate('/admin/users')}>Bekor qilish</Button>
            <Button type="primary" htmlType="submit" icon={<Save size={17} />} loading={createMutation.isPending}>
              Foydalanuvchi yaratish
            </Button>
          </div>
        </Form>
      </section>
    </main>
  );
}
