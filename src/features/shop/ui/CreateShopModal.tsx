import { ImagePlus, Store } from 'lucide-react';
import { App, Button, Col, Form, Input, Modal, Row, Select, Upload } from 'antd';
import type { UploadProps } from 'antd';
import type { ShopMediaKind } from '../model/useShopMediaDraft';
import type { ShopProfileFormValues } from '../model/shopProfile';
import styles from './CreateShopModal.module.css';

interface CreateShopModalProps {
  open: boolean;
  saving: boolean;
  preview: { logoUrl?: string; bannerUrl?: string };
  onImageSelect: (kind: ShopMediaKind, file: File) => Promise<void>;
  onCancel: () => void;
  onSubmit: (values: ShopProfileFormValues) => void;
}

const regionOptions = [{ value: '1', label: 'Toshkent shahri' }];
const districtOptions = [{ value: '10', label: 'Yashnobod tumani' }];

export function CreateShopModal({
  open,
  saving,
  preview,
  onImageSelect,
  onCancel,
  onSubmit,
}: CreateShopModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ShopProfileFormValues>();
  const uploadProps = (kind: ShopMediaKind): UploadProps => ({
    accept: 'image/jpeg,image/png,image/webp',
    showUploadList: false,
    beforeUpload: async (file) => {
      try {
        await onImageSelect(kind, file);
      } catch (error) {
        void message.error(error instanceof Error ? error.message : 'Rasmni o‘qib bo‘lmadi');
      }
      return false;
    },
  });

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

      <div className={styles.mediaGrid}>
        <Upload {...uploadProps('banner')}>
          <button
            type="button"
            className={`${styles.mediaButton} ${styles.bannerButton}`}
            style={preview.bannerUrl ? { backgroundImage: `url(${preview.bannerUrl})` } : undefined}
          >
            <span><ImagePlus /> Banner tanlash</span>
            <small>JPG, PNG yoki WEBP · 5 MB gacha</small>
          </button>
        </Upload>
        <Upload {...uploadProps('logo')}>
          <button type="button" className={styles.logoButton}>
            {preview.logoUrl ? <img src={preview.logoUrl} alt="Logo ko‘rinishi" /> : <Store />}
            <span>Logo tanlash</span>
          </button>
        </Upload>
      </div>

      <Form<ShopProfileFormValues>
        form={form}
        layout="vertical"
        requiredMark
        className={styles.form}
        onFinish={onSubmit}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="name" label="Do‘kon nomi" rules={[{ required: true, whitespace: true, max: 80 }]}>
              <Input maxLength={80} placeholder="Masalan, MarketHub Store" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="phone" label="Telefon" rules={[{ required: true }, { pattern: /^\+998(?:\s?\d){9}$/, message: '+998901234567 formatida kiriting' }]}>
              <Input placeholder="+998901234567" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="regionId" label="Viloyat" rules={[{ required: true, message: 'Viloyatni tanlang' }]}>
              <Select options={regionOptions} placeholder="Viloyatni tanlang" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="districtId" label="Tuman" rules={[{ required: true, message: 'Tumanni tanlang' }]}>
              <Select options={districtOptions} placeholder="Tumanni tanlang" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="address" label="Manzil" rules={[{ required: true, whitespace: true }]}>
          <Input maxLength={180} placeholder="Ko‘cha, uy va mo‘ljal" />
        </Form.Item>
        <Form.Item name="description" label="Do‘kon haqida" rules={[{ required: true, whitespace: true }, { max: 500 }]}>
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
