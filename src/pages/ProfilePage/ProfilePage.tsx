import { MapPin, Pencil, Phone, Store } from 'lucide-react';
import { App, Avatar, Button, Form, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useSellerShopQuery, useUpdateSellerShopMutation } from '../../features/shop/api/sellerShopQueries';
import type { UpdateSellerShopPayload } from '../../features/shop/api/sellerShopApi';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { FormModal } from '../../shared/ui/FormModal/FormModal';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { TextAreaControl, TextControl } from '../../shared/ui/FormControls/FormControls';
import styles from './ProfilePage.module.css';

type ProfileFormValues = Required<Pick<
  UpdateSellerShopPayload,
  'name' | 'description' | 'phone' | 'regionId' | 'districtId' | 'address'
>>;

const statusLabels = { ACTIVE: 'Faol', PENDING: 'Tekshiruvda', SUSPENDED: 'To‘xtatilgan', REJECTED: 'Rad etilgan' } as const;

export default function ProfilePage() {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<ProfileFormValues>();
  const shopQuery = useSellerShopQuery();
  const updateMutation = useUpdateSellerShopMutation();

  if (shopQuery.isPending) return <ContentState state="loading" />;
  if (shopQuery.isError) return <ContentState state="error" title="Profilni yuklab bo‘lmadi" description={getAuthErrorMessage(shopQuery.error)} onAction={() => void shopQuery.refetch()} />;

  const shop = updateMutation.isSuccess
    ? { ...shopQuery.data, ...updateMutation.data, ...updateMutation.variables }
    : shopQuery.data;
  const initialValues: ProfileFormValues = {
    name: shop.name,
    description: shop.description ?? '',
    phone: shop.phone ?? '',
    regionId: shop.regionId ?? '',
    districtId: shop.districtId ?? '',
    address: shop.address ?? '',
  };

  const save = (values: ProfileFormValues) => {
    updateMutation.mutate({
      name: values.name.trim(),
      description: values.description.trim(),
      phone: values.phone.replace(/\s/g, ''),
      regionId: values.regionId.trim(),
      districtId: values.districtId.trim(),
      address: values.address.trim(),
    }, {
      onSuccess: () => { setOpen(false); void message.success('Profil yangilandi'); },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  return <main className={styles.page}>
    <PageHeader title="Mening profilim" description="Do‘kon profilingiz va aloqa ma’lumotlari" extra={<Button type="primary" icon={<Pencil />} onClick={() => { form.setFieldsValue(initialValues); setOpen(true); }}>Tahrirlash</Button>} />
    <section className={styles.profile}>
      <header className={styles.identity}>
        <Avatar size={72} src={shop.logoUrl}>{shop.name.slice(0, 2).toUpperCase()}</Avatar>
        <div><Typography.Title level={2}>{shop.name}</Typography.Title><div className={styles.tags}><Tag color="gold">{shop.slug}</Tag><Tag color={shop.status === 'ACTIVE' ? 'success' : 'warning'}>{statusLabels[shop.status]}</Tag></div></div>
      </header>
      <div className={styles.sectionTitle}><Store /><div><strong>Do‘kon ma’lumotlari</strong><span>Xaridorlarga ko‘rinadigan profil ma’lumotlari</span></div></div>
      <dl className={styles.infoGrid}>
        <div><dt><Store /> Nomi</dt><dd>{shop.name}</dd></div>
        <div><dt><Phone /> Telefon</dt><dd>{shop.phone || '—'}</dd></div>
        <div><dt><MapPin /> Manzil</dt><dd>{shop.address || '—'}</dd></div>
        <div><dt><Store /> Buyurtmalar</dt><dd>{shop.ordersCount} ta</dd></div>
      </dl>
    </section>
    <FormModal<ProfileFormValues> open={open} title="Profilni tahrirlash" form={form} submitText="Saqlash" loading={updateMutation.isPending} onCancel={() => setOpen(false)} onSubmit={save}>
      <Form.Item label="Do‘kon nomi" name="name" rules={[{ required: true, whitespace: true }, { max: 80 }]}><TextControl /></Form.Item>
      <Form.Item label="Telefon" name="phone" rules={[{ required: true }, { pattern: /^\+998(?:\s?\d){9}$/, message: '+998901234567 formatida kiriting' }]}><TextControl /></Form.Item>
      <Form.Item label="Tavsif" name="description" rules={[{ required: true, whitespace: true }, { max: 500 }]}><TextAreaControl rows={3} maxLength={500} /></Form.Item>
      <Form.Item label="Viloyat ID" name="regionId" rules={[{ required: true }, { max: 40 }]}><TextControl /></Form.Item>
      <Form.Item label="Tuman ID" name="districtId" rules={[{ required: true }, { max: 40 }]}><TextControl /></Form.Item>
      <Form.Item label="Manzil" name="address" rules={[{ required: true, whitespace: true }, { max: 240 }]}><TextControl /></Form.Item>
    </FormModal>
  </main>;
}
