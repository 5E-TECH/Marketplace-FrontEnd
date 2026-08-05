import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Button, Divider, Form, Input, InputNumber, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { Product } from '../../model/sellerTypes';
import { ImageUpload } from '../../../../shared/ui/ImageUpload/ImageUpload';
import styles from './ProductForm.module.css';

export type ProductFormValues = Omit<Product, 'id' | 'status'>;

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

      <section className={styles.card} aria-labelledby="product-variants-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="product-variants-title">Variantlar</h2>
            <p>Rang, o‘lcham yoki boshqa variantlarni alohida boshqaring.</p>
          </div>
        </div>
        <Form.List name="variants">
          {(fields, { add, remove }) => (
            <div className={styles.variants}>
              {fields.map((field, index) => (
                <div className={styles.variant} key={field.key}>
                  <Divider>Variant {index + 1}</Divider>
                  <div className={styles.variantGrid}>
                    <Form.Item {...field} label="Nomi" name={[field.name, 'name']} rules={[{ required: true, message: 'Variant nomini kiriting' }]}>
                      <Input placeholder="Masalan, Qora / XL" />
                    </Form.Item>
                    <Form.Item {...field} label="SKU" name={[field.name, 'sku']} rules={[{ required: true, message: 'SKU kiriting' }]}>
                      <Input placeholder="PRD-001-BLK" />
                    </Form.Item>
                    <Form.Item {...field} label="Narxi" name={[field.name, 'price']}>
                      <InputNumber min={0} placeholder="Narx" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item {...field} label="Qoldiq" name={[field.name, 'stock']}>
                      <InputNumber min={0} placeholder="Qoldiq" style={{ width: '100%' }} />
                    </Form.Item>
                    <Button className={styles.removeVariant} danger type="text" icon={<Trash2 />} aria-label={`${index + 1}-variantni o‘chirish`} onClick={() => remove(field.name)} />
                  </div>
                </div>
              ))}
              <Button className={styles.addVariant} type="dashed" icon={<Plus />} onClick={() => add()}>
                Variant qo‘shish
              </Button>
            </div>
          )}
        </Form.List>
      </section>

      <section className={styles.card} aria-labelledby="product-images-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="product-images-title">Mahsulot rasmlari</h2>
            <p>JPG, PNG yoki WEBP · maksimum 5 MB.</p>
          </div>
        </div>
        <ImageUpload />
      </section>

      <div className={styles.actions}>
        <Button icon={<ArrowLeft />} onClick={onCancel}>Bekor qilish</Button>
        <Button type="primary" htmlType="submit" icon={<Save />} loading={submitting}>{submitLabel}</Button>
      </div>
    </Form>
  );
}
