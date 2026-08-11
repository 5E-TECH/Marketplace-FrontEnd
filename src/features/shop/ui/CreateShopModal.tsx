import { Store } from 'lucide-react';
import { Button, Col, Form, Input, Modal, Row } from 'antd';
import styles from './CreateShopModal.module.css';

interface CreateShopModalProps {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: SellerRegistrationFormValues) => void;
}

export interface SellerRegistrationFormValues {
  name: string;
  phone: string;
  password: string;
  email?: string;
  shopName: string;
  shopDescription?: string;
  address?: string;
}

export function CreateShopModal({
  open,
  saving,
  onCancel,
  onSubmit,
}: CreateShopModalProps) {
  const [form] = Form.useForm<SellerRegistrationFormValues>();

  return (
    <Modal
      open={open}
      width={760}
      title={null}
      footer={null}
      destroyOnHidden
      closable={!saving}
      maskClosable={!saving}
      onCancel={onCancel}
      afterOpenChange={(isOpen) => {
        if (!isOpen) form.resetFields();
      }}
    >
      <div className={styles.heading}>
        <span className={styles.headingIcon}><Store /></span>
        <div>
          <h2>Yangi do‘kon yaratish</h2>
          <p>Xaridorlarga ko‘rinadigan ma’lumotlar va do‘kon ko‘rinishini kiriting.</p>
        </div>
      </div>

      <Form<SellerRegistrationFormValues>
        form={form}
        layout="vertical"
        requiredMark
        className={styles.form}
        onFinish={onSubmit}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="name" label="Ism va familiya" rules={[{ required: true, whitespace: true, max: 80 }]}>
              <Input maxLength={80} placeholder="Ali Valiyev" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="phone" label="Telefon" rules={[{ required: true }, { pattern: /^\+998(?:\s?\d){9}$/, message: '+998901234567 formatida kiriting' }]}>
              <Input placeholder="+998901234567" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="password" label="Parol" rules={[{ required: true, message: 'Parolni kiriting' }, { min: 8, message: 'Parol kamida 8 belgi bo‘lsin' }]}>
              <Input.Password maxLength={128} autoComplete="new-password" placeholder="Kamida 8 belgi" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Emailni to‘g‘ri kiriting' }]}>
              <Input maxLength={120} placeholder="seller@example.com" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="shopName" label="Do‘kon nomi" rules={[{ required: true, whitespace: true, message: 'Do‘kon nomini kiriting' }, { max: 80 }]}>
              <Input maxLength={80} placeholder="Ali Market" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="address" label="Manzil" rules={[{ max: 180 }]}>
          <Input maxLength={180} placeholder="Ko‘cha, uy va mo‘ljal" />
        </Form.Item>
        <Form.Item name="shopDescription" label="Do‘kon haqida" rules={[{ max: 500 }]}>
          <Input.TextArea rows={3} maxLength={500} showCount placeholder="Mahsulotlaringiz va do‘kon afzalliklarini yozing" />
        </Form.Item>
        <div className={styles.actions}>
          <Button disabled={saving} onClick={onCancel}>Bekor qilish</Button>
          <Button type="primary" htmlType="submit" loading={saving}>Do‘konni yaratish</Button>
        </div>
      </Form>
    </Modal>
  );
}
