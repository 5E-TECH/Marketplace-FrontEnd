import { ArrowLeft, Save } from 'lucide-react';
import { Button, Form, Input, InputNumber, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { ProductUpsertPayload } from '../../model/productTypes';
import { ImageUpload } from '../../../../shared/ui/ImageUpload/ImageUpload';
import styles from './ProductForm.module.css';

export type ProductFormValues = ProductUpsertPayload;

interface ProductFormProps {
  form: FormInstance<ProductFormValues>;
  initialValues: ProductFormValues;
  submitting?: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (values: ProductFormValues) => void;
}

const categories = ['Elektronika', 'Aksessuarlar', 'Uy-ro‘zg‘or'].map((value) => ({
  label: value,
  value,
}));

export function ProductForm({
  form,
  initialValues,
  submitting = false,
  submitLabel = 'Mahsulotni saqlash',
  onCancel,
  onSubmit,
}: ProductFormProps) {
  return (
    <Form<ProductFormValues>
      form={form}
      layout="vertical"
      requiredMark
      initialValues={initialValues}
      className={styles.form}
      onFinish={onSubmit}
    >
      <div className={styles.contentGrid}>
        <section className={styles.card} aria-labelledby="product-main-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="product-main-title">Asosiy ma’lumotlar</h2>
              <p>Mahsulotning katalogda ko‘rinadigan ma’lumotlarini kiriting.</p>
            </div>
          </div>

          <div className={styles.grid}>
            <Form.Item
              className={styles.fullWidth}
              label="Mahsulot nomi"
              name="name"
              rules={[{ required: true, message: 'Mahsulot nomini kiriting' }]}
            >
              <Input placeholder="Masalan, Simsiz quloqchin Pro" />
            </Form.Item>
            <Form.Item label="SKU" name="sku" rules={[{ required: true, message: 'SKU kiriting' }]}>
              <Input placeholder="PRD-001" />
            </Form.Item>
            <Form.Item
              label="Kategoriya"
              name="category"
              rules={[{ required: true, message: 'Kategoriyani tanlang' }]}
            >
              <Select placeholder="Kategoriyani tanlang" options={categories} />
            </Form.Item>
            <Form.Item label="Narxi" name="price" rules={[{ required: true, message: 'Narxni kiriting' }]}>
              <InputNumber min={0} addonAfter="so‘m" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="Boshlang‘ich qoldiq"
              name="stock"
              rules={[{ required: true, message: 'Qoldiqni kiriting' }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </section>

        <section className={`${styles.card} ${styles.uploadCard}`} aria-labelledby="product-images-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="product-images-title">Mahsulot rasmlari</h2>
              <p>Asosiy rasmni birinchi yuklang.</p>
            </div>
          </div>
          <ImageUpload />
        </section>
      </div>

      <div className={styles.actions}>
        <Button icon={<ArrowLeft />} onClick={onCancel}>Bekor qilish</Button>
        <Button type="primary" htmlType="submit" icon={<Save />} loading={submitting}>{submitLabel}</Button>
      </div>
    </Form>
  );
}
