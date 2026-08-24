import { Camera, LockKeyhole, Mail, Pencil, Phone, UserRound } from 'lucide-react';
import { App, Avatar, Button, Form, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { loggedOut, selectAuthUser } from '../../features/auth/model/authSlice';
import type { UpdateAuthProfilePayload } from '../../features/auth/model/authTypes';
import { useUpdateAuthProfileMutation } from '../../features/auth/api/useUpdateAuthProfileMutation';
import { getApiFieldErrors, getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { TextControl } from '../../shared/ui/FormControls/FormControls';
import { PasswordInput } from '../../shared/ui/PasswordInput/PasswordInput';
import { authStorage } from '../../features/auth/lib/authStorage';
import styles from './ProfilePage.module.css';

interface ProfileFormValues {
  name: string;
  phone: string;
  email?: string;
  avatarUrl?: string;
  password?: string;
  confirmPassword?: string;
}

const EDITABLE_FIELDS = new Set<keyof ProfileFormValues>([
  'name', 'phone', 'email', 'avatarUrl', 'password', 'confirmPassword',
]);
const normalizedOptional = (value?: string | null) => value?.trim() || '';

export default function ProfilePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const user = useAppSelector(selectAuthUser);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<ProfileFormValues>();
  const updateMutation = useUpdateAuthProfileMutation();

  if (!user) {
    return <ContentState state="error" title="Profil ma’lumoti topilmadi" description="Sahifani yangilang yoki qayta tizimga kiring." />;
  }

  const initialValues: ProfileFormValues = {
    name: user.name,
    phone: user.phone,
    email: user.email ?? '',
    avatarUrl: user.avatarUrl ?? '',
    password: '',
    confirmPassword: '',
  };

  const buildPayload = (values: ProfileFormValues): UpdateAuthProfilePayload => {
    const payload: UpdateAuthProfilePayload = {};
    const name = values.name.trim();
    const phone = values.phone.replace(/\s/g, '');
    const email = normalizedOptional(values.email);
    const avatarUrl = normalizedOptional(values.avatarUrl);
    if (name !== user.name) payload.name = name;
    if (phone !== user.phone) payload.phone = phone;
    if (email && email !== normalizedOptional(user.email)) payload.email = email;
    if (avatarUrl && avatarUrl !== normalizedOptional(user.avatarUrl)) payload.avatarUrl = avatarUrl;
    if (values.password) payload.password = values.password;
    return payload;
  };

  const endSessionAfterPasswordChange = () => {
    form.setFieldsValue({ password: '', confirmPassword: '' });
    authStorage.setNotice('Parol yangilandi, qayta tizimga kiring');
    queryClient.clear();
    dispatch(loggedOut());
    void navigate('/login', { replace: true });
  };

  const save = async (values: ProfileFormValues) => {
    if (updateMutation.isPending) return;
    const payload = buildPayload(values);
    if (Object.keys(payload).length === 0) {
      void message.info('O‘zgartirilgan ma’lumot yo‘q');
      return;
    }
    try {
      await updateMutation.mutateAsync(payload);
      form.setFieldsValue({ password: '', confirmPassword: '' });
      if (payload.password) {
        endSessionAfterPasswordChange();
        return;
      }
      setOpen(false);
      void message.success('Profil muvaffaqiyatli yangilandi');
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error).filter(({ name }) => EDITABLE_FIELDS.has(name as keyof ProfileFormValues));
      if (fieldErrors.length) form.setFields(fieldErrors.map(({ name, errors }) => ({ name: [name as keyof ProfileFormValues], errors })));
      else void message.error(getAuthErrorMessage(error));
    }
  };

  return <main className={styles.page}>
    <PageHeader title="Mening profilim" description="Shaxsiy ma’lumotlar va akkaunt xavfsizligini boshqaring" />
    <section className={styles.profile}>
      <header className={styles.identity}>
        <Avatar size={72} src={user.avatarUrl}>{user.name.slice(0, 2).toUpperCase()}</Avatar>
        <div className={styles.identityContent}><Typography.Title level={2}>{user.name}</Typography.Title><Tag color="gold">{user.role}</Tag></div>
        <Button className={styles.editButton} type="primary" icon={<Pencil />} onClick={() => { form.setFieldsValue(initialValues); setOpen(true); }}>Tahrirlash</Button>
      </header>
      <div className={styles.sectionTitle}><UserRound /><div><strong>Akkaunt ma’lumotlari</strong><span>Profil response’idan olingan ma’lumotlar</span></div></div>
      <dl className={styles.infoGrid}>
        <div><dt><UserRound /> Ism</dt><dd>{user.name}</dd></div>
        <div><dt><Phone /> Telefon</dt><dd>{user.phone}</dd></div>
        <div><dt><Mail /> Email</dt><dd>{user.email || '—'}</dd></div>
        <div><dt><Camera /> Avatar</dt><dd>{user.avatarUrl || 'Kiritilmagan'}</dd></div>
      </dl>
    </section>
    <FormModal<ProfileFormValues> open={open} title="Profilni tahrirlash" form={form} submitText="Saqlash" loading={updateMutation.isPending} onCancel={() => setOpen(false)} onSubmit={save}>
      <Form.Item label="Ism" name="name" rules={[{ required: true, whitespace: true, message: 'Ismni kiriting' }, { max: 100 }]}><TextControl autoComplete="name" /></Form.Item>
      <Form.Item label="Telefon" name="phone" rules={[{ required: true, message: 'Telefon raqamini kiriting' }, { pattern: /^\+998\d{9}$/, message: '+998901234567 formatida kiriting' }]}><TextControl autoComplete="tel" placeholder="+998901234567" /></Form.Item>
      <Form.Item label="Email" name="email" rules={[{ type: 'email', message: 'Email manzilini to‘g‘ri kiriting' }, { max: 120 }]}><TextControl autoComplete="email" placeholder="ali@example.com" /></Form.Item>
      <Form.Item label="Avatar URL" name="avatarUrl" rules={[{ type: 'url', message: 'To‘g‘ri URL kiriting' }, { max: 2048 }]}><TextControl autoComplete="url" placeholder="https://cdn.example.com/avatar.jpg" /></Form.Item>
      <div className={styles.passwordHeading}><LockKeyhole /><div><strong>Yangi parol</strong><span>Ixtiyoriy — o‘zgartirmasangiz bo‘sh qoldiring</span></div></div>
      <Form.Item label="Yangi parol" name="password" dependencies={['confirmPassword']} rules={[{ min: 4, message: 'Parol kamida 4 ta belgi bo‘lishi kerak' }]}><PasswordInput autoComplete="new-password" /></Form.Item>
      <Form.Item label="Yangi parolni tasdiqlash" name="confirmPassword" dependencies={['password']} rules={[({ getFieldValue }) => ({ validator: (_, value: string | undefined) => { const password = getFieldValue('password') as string | undefined; if (!password && !value) return Promise.resolve(); return value === password ? Promise.resolve() : Promise.reject(new Error('Parollar bir xil emas')); } })]}><PasswordInput autoComplete="new-password" /></Form.Item>
    </FormModal>
  </main>;
}
