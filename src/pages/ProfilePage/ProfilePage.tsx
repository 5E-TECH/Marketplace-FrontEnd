import { AtSign, IdCard, Pencil, Phone, ShieldCheck, User } from 'lucide-react';
import { App, Avatar, Button, Form, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { useUpdateProfileMutation } from '../../features/auth/api/useUpdateProfileMutation';
import type { UserRole } from '../../features/auth/model/authTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { TextControl } from '../../shared/ui/FormControls/FormControls';
import { PasswordInput } from '../../shared/ui/PasswordInput/PasswordInput';
import styles from './ProfilePage.module.css';

interface AccountFormValues {
  name: string;
  phone: string;
}

interface PasswordFormValues {
  password: string;
  confirmPassword: string;
}

const roleLabels: Record<UserRole, string> = {
  SELLER: 'Sotuvchi',
  OPERATOR: 'Operator',
  BUYER: 'Xaridor',
  ADMIN: 'Administrator',
  SUPERADMIN: 'Bosh administrator',
};

/**
 * Akkaunt sahifasi — foydalanuvchining o'z ma'lumoti (`/auth/me`).
 * Do'kon ma'lumotlari alohida sahifada (`/shop`).
 */
export default function ProfilePage() {
  const { message } = App.useApp();
  const user = useAppSelector(selectAuthUser);
  const [accountForm] = Form.useForm<AccountFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [accountOpen, setAccountOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const updateMutation = useUpdateProfileMutation();

  if (!user) {
    return (
      <ContentState
        state="error"
        title="Profil ma’lumoti olinmadi"
        description="Sahifani yangilang yoki qayta tizimga kiring."
      />
    );
  }

  const saveAccount = (values: AccountFormValues) => {
    updateMutation.mutate(
      {
        name: values.name.trim(),
        phone: values.phone.replace(/\s/g, ''),
      },
      {
        onSuccess: () => {
          setAccountOpen(false);
          void message.success('Profil yangilandi');
        },
        onError: (error) => void message.error(getAuthErrorMessage(error)),
      },
    );
  };

  const savePassword = (values: PasswordFormValues) => {
    updateMutation.mutate(
      { password: values.password },
      {
        onSuccess: () => {
          setPasswordOpen(false);
          passwordForm.resetFields();
          void message.success('Parol yangilandi');
        },
        onError: (error) => void message.error(getAuthErrorMessage(error)),
      },
    );
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="Mening profilim"
        description="Akkaunt ma’lumotlaringiz va kirish paroli"
        extra={
          <Button
            type="primary"
            icon={<Pencil />}
            onClick={() => {
              accountForm.setFieldsValue({ name: user.name, phone: user.phone });
              setAccountOpen(true);
            }}
          >
            Tahrirlash
          </Button>
        }
      />

      <section className={styles.profile}>
        <header className={styles.identity}>
          <Avatar size={72} src={user.avatarUrl}>
            {user.name.slice(0, 2).toUpperCase()}
          </Avatar>
          <div>
            <Typography.Title level={2}>{user.name}</Typography.Title>
            <div className={styles.tags}>
              <Tag color="gold">{roleLabels[user.role]}</Tag>
              <Tag color={user.isActive ? 'success' : 'warning'}>
                {user.isActive ? 'Faol' : 'Faolsizlantirilgan'}
              </Tag>
            </div>
          </div>
        </header>

        <div className={styles.sectionTitle}>
          <User />
          <div>
            <strong>Shaxsiy ma’lumotlar</strong>
            <span>Faqat sizga ko‘rinadigan akkaunt ma’lumotlari</span>
          </div>
        </div>

        <dl className={styles.infoGrid}>
          <div>
            <dt>
              <User /> Ism
            </dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>
              <Phone /> Telefon
            </dt>
            <dd>{user.phone}</dd>
          </div>
          <div>
            <dt>
              <AtSign /> Email
            </dt>
            <dd>{user.email ?? '—'}</dd>
          </div>
          <div>
            <dt>
              <IdCard /> Rol
            </dt>
            <dd>{roleLabels[user.role]}</dd>
          </div>
        </dl>

        <div className={styles.sectionTitle}>
          <ShieldCheck />
          <div>
            <strong>Xavfsizlik</strong>
            <span>Kirish parolini istalgan vaqtda almashtiring</span>
          </div>
        </div>

        <Button onClick={() => setPasswordOpen(true)}>Parolni o‘zgartirish</Button>
      </section>

      <FormModal<AccountFormValues>
        open={accountOpen}
        title="Akkauntni tahrirlash"
        form={accountForm}
        submitText="Saqlash"
        loading={updateMutation.isPending}
        onCancel={() => setAccountOpen(false)}
        onSubmit={saveAccount}
      >
        <Form.Item
          label="Ism"
          name="name"
          rules={[{ required: true, whitespace: true }, { max: 255 }]}
        >
          <TextControl />
        </Form.Item>
        <Form.Item
          label="Telefon"
          name="phone"
          rules={[
            { required: true },
            {
              pattern: /^\+998(?:\s?\d){9}$/,
              message: '+998901234567 formatida kiriting',
            },
          ]}
        >
          <TextControl />
        </Form.Item>
      </FormModal>

      <FormModal<PasswordFormValues>
        open={passwordOpen}
        title="Parolni o‘zgartirish"
        form={passwordForm}
        submitText="Saqlash"
        loading={updateMutation.isPending}
        onCancel={() => setPasswordOpen(false)}
        onSubmit={savePassword}
      >
        <Form.Item
          label="Yangi parol"
          name="password"
          rules={[{ required: true }, { min: 4, message: 'Kamida 4 belgi' }]}
        >
          <PasswordInput />
        </Form.Item>
        <Form.Item
          label="Parolni tasdiqlang"
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator: (_, value: string) =>
                !value || getFieldValue('password') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error('Parollar mos kelmadi')),
            }),
          ]}
        >
          <PasswordInput />
        </Form.Item>
      </FormModal>
    </main>
  );
}
