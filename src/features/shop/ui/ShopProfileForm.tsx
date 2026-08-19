import {
  FileText as FileTextOutlined,
  MapPin as EnvironmentOutlined,
  Pencil as EditOutlined,
  Phone as PhoneOutlined,
  Save as SaveOutlined,
  Store as ShopOutlined,
  X as CloseOutlined,
} from 'lucide-react';
import { Button, Col, Form, Input, Row, Select, Space, Typography } from 'antd';
import type { FormInstance } from 'antd';
import type { ShopProfileFormValues } from '../model/shopProfile';
import styles from './ShopProfileForm.module.css';

interface ShopProfileFormProps {
  form: FormInstance<ShopProfileFormValues>;
  initialValues: ShopProfileFormValues;
  editing: boolean;
  saving?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (values: ShopProfileFormValues) => void;
}

const regionOptions = [{ value: '1', label: 'Toshkent shahri' }];
const districtOptions = [{ value: '10', label: 'Yashnobod tumani' }];

export function ShopProfileForm({
  form,
  initialValues,
  editing,
  saving = false,
  onEdit,
  onCancel,
  onSubmit,
}: ShopProfileFormProps) {
  return (
    <section className={styles.profileCard}>
      <header className={styles.cardHeader}>
        <div>
          <Typography.Title level={3}>Do‘kon ma’lumotlari</Typography.Title>
          <Typography.Text>Nomi, tavsifi, aloqa va manzil ma’lumotlari</Typography.Text>
        </div>
        {editing ? (
          <Space wrap>
            <Button
              icon={<CloseOutlined />}
              disabled={saving}
              onClick={onCancel}
            >
              Bekor
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void form.submit()}
            >
              Saqlash
            </Button>
          </Space>
        ) : (
          <Button type="primary" icon={<EditOutlined />} onClick={onEdit}>
            Tahrirlash
          </Button>
        )}
      </header>

      <Form<ShopProfileFormValues>
        form={form}
        initialValues={initialValues}
        layout="vertical"
        requiredMark={editing}
        disabled={!editing || saving}
        onFinish={onSubmit}
        className={`${styles.form} ${editing ? styles.editingForm : styles.readonlyForm}`}
      >
        <Row gutter={[22, 0]}>
          <Col xs={24} md={12}>
            <Form.Item
              label={<><ShopOutlined /> Do‘kon nomi</>}
              name="name"
              rules={[
                { required: true, whitespace: true, message: 'Do‘kon nomini kiriting' },
                { max: 80, message: 'Maksimum 80 belgi' },
              ]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label={<><PhoneOutlined /> Telefon</>}
              name="phone"
              rules={[
                { required: true, message: 'Telefon raqamini kiriting' },
                { pattern: /^\+998(?:\s?\d){9}$/, message: '+998901234567 formatida kiriting' },
              ]}
            >
              <Input placeholder="+998901234567" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[22, 0]}>
          <Col xs={24} md={12}>
            <Form.Item
              label={<><EnvironmentOutlined /> Viloyat</>}
              name="regionId"
              rules={[{ required: true, message: 'Viloyatni tanlang' }]}
            >
              <Select options={regionOptions} placeholder="Viloyatni tanlang" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label={<><EnvironmentOutlined /> Tuman</>}
              name="districtId"
              rules={[{ required: true, message: 'Tumanni tanlang' }]}
            >
              <Select options={districtOptions} placeholder="Tumanni tanlang" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label={<><EnvironmentOutlined /> Manzil</>}
          name="address"
          rules={[{ required: true, whitespace: true, message: 'Manzilni kiriting' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label={<><FileTextOutlined /> Tavsif</>}
          name="description"
          rules={[
            { required: true, whitespace: true, message: 'Do‘kon haqida yozing' },
            { max: 500, message: 'Maksimum 500 belgi' },
          ]}
        >
          <Input.TextArea rows={editing ? 3 : 1} maxLength={500} showCount={editing} />
        </Form.Item>

      </Form>
    </section>
  );
}
