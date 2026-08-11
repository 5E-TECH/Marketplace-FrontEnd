import { Pencil, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { App, Avatar, Button, Form, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { useUpdateSellerProfileMutation } from '../../features/auth/api/useUpdateSellerProfileMutation';
import type { UpdateSellerProfilePayload } from '../../features/auth/api/authApi';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { TextControl } from '../../shared/ui/FormControls/FormControls';
import styles from './ProfilePage.module.css';

const roleLabels = { SELLER: 'Sotuvchi', BUYER: 'Xaridor', ADMIN: 'Administrator', SUPERADMIN: 'Super administrator' } as const;

export default function ProfilePage() {
  const { message } = App.useApp();
  const user = useAppSelector(selectAuthUser);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<UpdateSellerProfilePayload>();
  const updateMutation = useUpdateSellerProfileMutation();
  if (!user) return null;

  const startEditing = () => {
    form.setFieldsValue({ name: user.name, phone: user.phone });
    setOpen(true);
  };
  const save = (values: UpdateSellerProfilePayload) => {
    updateMutation.mutate({
      name: values.name.trim(),
      phone: values.phone.replace(/\s/g, ''),
    }, {
      onSuccess: () => { setOpen(false); void message.success('Profil yangilandi'); },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  return <main className={styles.page}>
    <PageHeader title="Mening profilim" description="Shaxsiy akkaunt va kirish ma’lumotlari" extra={<Button type="primary" icon={<Pencil />} onClick={startEditing}>Tahrirlash</Button>} />
    <section className={styles.profile}>
      <header className={styles.identity}>
        <Avatar size={72} src={user.avatarUrl}>{user.name.slice(0, 2).toUpperCase()}</Avatar>
        <div><Typography.Title level={2}>{user.name}</Typography.Title><div className={styles.tags}><Tag color="gold">{roleLabels[user.role]}</Tag><Tag color={user.isActive ? 'success' : 'warning'}>{user.isActive ? 'Faol akkaunt' : 'Tekshiruvda'}</Tag></div></div>
      </header>
      <div className={styles.sectionTitle}><UserRound /><div><strong>Shaxsiy ma’lumotlar</strong><span>Akkaunt egasiga tegishli ma’lumotlar</span></div></div>
      <dl className={styles.infoGrid}>
        <div><dt><UserRound /> Ism</dt><dd>{user.name}</dd></div>
        <div><dt><Phone /> Telefon</dt><dd>{user.phone}</dd></div>
        <div><dt><ShieldCheck /> Rol</dt><dd>{roleLabels[user.role]}</dd></div>
      </dl>
    </section>
    <FormModal<UpdateSellerProfilePayload> open={open} title="Profilni tahrirlash" form={form} submitText="Saqlash" loading={updateMutation.isPending} onCancel={() => setOpen(false)} onSubmit={save}>
      <p className={styles.modalDescription}>Ism va telefon raqamingizni yangilang.</p>
      <Form.Item label="Ism" name="name" rules={[{ required: true, whitespace: true, message: 'Ismni kiriting' }, { max: 100 }]}><TextControl autoComplete="name" /></Form.Item>
      <Form.Item label="Telefon" name="phone" rules={[{ required: true, message: 'Telefonni kiriting' }, { pattern: /^\+998(?:\s?\d){9}$/, message: '+998901234567 formatida kiriting' }]}><TextControl autoComplete="tel" placeholder="+998901234567" /></Form.Item>
    </FormModal>
  </main>;
}
