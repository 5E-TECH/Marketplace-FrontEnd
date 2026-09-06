import { App, Button, Form, Result, Select } from 'antd';
import { CheckCircle2, MapPin, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useAppSelector } from '../../app/store/hooks';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { useConfirmCheckoutMutation, useCreateCheckoutMutation } from '../../features/orders/api/orderQueries';
import type { CheckoutPaymentMethod } from '../../features/orders/model/orderTypes';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { TextAreaControl, TextControl } from '../../shared/ui/FormControls/FormControls';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './CheckoutPage.module.css';

interface CheckoutFormValues {
  paymentMethod: CheckoutPaymentMethod;
  regionId: string;
  districtId: string;
  address: string;
}

function readOrderId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  for (const key of ['orderId', 'id', 'salesOrderId']) {
    const candidate = record[key];
    if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate);
  }
  return null;
}

export default function CheckoutPage() {
  const { message } = App.useApp();
  const user = useAppSelector(selectAuthUser);
  const [form] = Form.useForm<CheckoutFormValues>();
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('COD');
  const createMutation = useCreateCheckoutMutation();
  const confirmMutation = useConfirmCheckoutMutation();

  if (user?.role !== 'BUYER') return <ContentState state="forbidden" title="Checkout faqat xaridor uchun" description="Buyurtma yaratish uchun BUYER akkauntidan foydalaning." />;

  const submit = (values: CheckoutFormValues) => createMutation.mutate({
    paymentMethod: values.paymentMethod,
    address: { regionId: values.regionId.trim(), districtId: values.districtId.trim(), address: values.address.trim(), whereDeliver: 'ADDRESS' },
    idempotencyKey: crypto.randomUUID(),
  }, {
    onSuccess: (data) => {
      const orderId = readOrderId(data);
      setCreatedOrderId(orderId);
      void message.success('Buyurtma yaratildi');
    },
    onError: (error) => void message.error(getAuthErrorMessage(error)),
  });

  if (createdOrderId) return <Result status="success" icon={<CheckCircle2 />} title="Buyurtma yaratildi" subTitle={`Buyurtma ID: #${createdOrderId}`} extra={paymentMethod === 'COD' ? <Button type="primary" loading={confirmMutation.isPending} onClick={() => confirmMutation.mutate({ orderId: createdOrderId }, { onSuccess: () => void message.success('COD buyurtma tasdiqlandi'), onError: (error) => void message.error(getAuthErrorMessage(error)) })}>COD buyurtmani tasdiqlash</Button> : null} />;

  return <main className={styles.page}>
    <PageHeader title="Buyurtma yaratish" description="Savatdagi mahsulotlar uchun yetkazib berish ma’lumotlarini kiriting" />
    <Form<CheckoutFormValues> form={form} layout="vertical" initialValues={{ paymentMethod: 'COD' }} onFinish={submit} className={styles.form} requiredMark="optional">
      <section className={styles.card}><header><ShoppingBag aria-hidden /><div><strong>To‘lov usuli</strong><span>Buyurtma uchun to‘lov turini tanlang</span></div></header>
        <Form.Item name="paymentMethod" label="To‘lov" rules={[{ required: true }]}><Select options={[{ value: 'COD', label: 'Yetkazib berishda (COD)' }, { value: 'PAYME', label: 'Payme' }, { value: 'CLICK', label: 'Click' }]} onChange={setPaymentMethod} /></Form.Item>
      </section>
      <section className={styles.card}><header><MapPin aria-hidden /><div><strong>Yetkazib berish manzili</strong><span>Buyurtma shu manzilga yetkaziladi</span></div></header>
        <div className={styles.grid}><Form.Item name="regionId" label="Viloyat ID" rules={[{ required: true, message: 'Viloyat IDni kiriting' }]}><TextControl inputMode="numeric" /></Form.Item><Form.Item name="districtId" label="Tuman ID" rules={[{ required: true, message: 'Tuman IDni kiriting' }]}><TextControl inputMode="numeric" /></Form.Item></div>
        <Form.Item name="address" label="To‘liq manzil" rules={[{ required: true, message: 'Manzilni kiriting' }, { min: 5 }]}><TextAreaControl rows={4} maxLength={300} showCount placeholder="Toshkent shahri, ko‘cha va uy raqami" /></Form.Item>
      </section>
      <Button className={styles.submit} type="primary" htmlType="submit" size="large" loading={createMutation.isPending}>Buyurtma yaratish</Button>
    </Form>
  </main>;
}
