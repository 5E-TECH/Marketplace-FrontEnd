import { Button, Form, Modal, Popconfirm, Switch, Tag } from 'antd';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ProductVariant } from '../../model/productTypes';
import { NumberControl, TextControl } from '../../../../shared/ui/FormControls/FormControls';
import styles from './VariantManager.module.css';
import { formatMoney } from '../../../../shared/ui/MoneyText/formatMoney';
import { DataTable } from '../../../../shared/ui/DataTable/DataTable';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';

interface VariantManagerProps {
  enabled: boolean;
  basePrice: number | null;
  value?: ProductVariant[];
  onChange?: (variants: ProductVariant[]) => void;
}

type VariantFormValues = ProductVariant;

export function VariantManager({ enabled, basePrice, value = [], onChange }: VariantManagerProps) {
  const [form] = Form.useForm<VariantFormValues>();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
    setEditingIndex(null);
    form.resetFields();
  };

  const addVariant = () => {
    setEditingIndex(null);
    form.setFieldsValue({ name: '', sku: '', price: basePrice, oldPrice: null, barcode: '', attributes: {}, imageUrl: null, isActive: true });
    setOpen(true);
  };

  const editVariant = (variant: ProductVariant, index: number) => {
    setEditingIndex(index);
    form.setFieldsValue(variant);
    setOpen(true);
  };

  const save = (variant: ProductVariant) => {
    const normalized: ProductVariant = {
      ...variant,
      name: variant.name.trim(),
      sku: variant.sku.trim(),
      attributes: variant.attributes ?? {},
      imageUrl: variant.imageUrl ?? null,
    };
    onChange?.(
      editingIndex === null
        ? [...value, normalized]
        : value.map((item, index) => (index === editingIndex ? normalized : item)),
    );
    close();
  };

  if (!enabled) {
    return (
      <section className={styles.defaultVariant} aria-label="Standart variant">
        <div>
          <Tag color="default">DEFAULT</Tag>
          <strong>Standart variant</strong>
          <span>Variantlarsiz mahsulot uchun avtomatik ishlatiladi.</span>
        </div>
        <b>{basePrice ? `${formatMoney(basePrice)} so‘m` : 'Narx kiritilmagan'}</b>
      </section>
    );
  }

  return (
    <section className={styles.manager} aria-labelledby="variants-title">
      <div className={styles.header}>
        <div>
          <h3 id="variants-title">Mahsulot variantlari</h3>
          <p>O‘lcham, rang yoki boshqa ko‘rinishlarni alohida boshqaring.</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={addVariant}>Variant qo‘shish</Button>
      </div>

      <DataTable<ProductVariant>
        rowKey={(variant) => `${variant.sku}-${variant.name}`}
        dataSource={value}
        pagination={false}
        emptyState={<EmptyState compact title="Hali variant qo‘shilmagan" description="" />}
        columns={[
          { title: 'Variant', dataIndex: 'name' },
          { title: 'SKU', dataIndex: 'sku', responsive: ['sm'], render: (sku: string) => <code>{sku}</code> },
          { title: 'Narx', dataIndex: 'price', align: 'right', render: (price: number | null) => price === null ? 'Asosiy narx' : `${formatMoney(price)} so‘m` },
          { title: 'Holati', dataIndex: 'isActive', align: 'center', responsive: ['md'], render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? 'Faol' : 'Nofaol'}</Tag> },
          {
            title: '', width: 92, align: 'right',
            render: (_value, variant, index) => (
              <div className={styles.actions}>
                <Button type="text" aria-label={`${variant.name} variantini tahrirlash`} icon={<Pencil size={16} />} onClick={() => editVariant(variant, index)} />
                <Popconfirm title="Variant o‘chirilsinmi?" okText="O‘chirish" cancelText="Bekor qilish" onConfirm={() => onChange?.(value.filter((_item, itemIndex) => itemIndex !== index))}>
                  <Button type="text" danger aria-label={`${variant.name} variantini o‘chirish`} icon={<Trash2 size={16} />} />
                </Popconfirm>
              </div>
            ),
          },
        ]}
      />

      <Modal title={editingIndex === null ? 'Yangi variant' : 'Variantni tahrirlash'} open={open} okText="Saqlash" cancelText="Bekor qilish" onCancel={close} onOk={() => form.submit()} destroyOnHidden>
        <Form<VariantFormValues> name="productVariant" form={form} layout="vertical" onFinish={save} className={styles.modalForm}>
          <Form.Item label="Variant nomi" name="name" rules={[{ required: true, whitespace: true, message: 'Variant nomini kiriting' }, { max: 100 }]}>
            <TextControl placeholder="Masalan, Qora / XL" maxLength={100} />
          </Form.Item>
          <Form.Item label="SKU" name="sku" rules={[{ required: true, whitespace: true, message: 'SKU kiriting' }, { max: 80 }, { validator: (_, sku: string) => value.some((item, index) => item.sku.toLowerCase() === sku?.trim().toLowerCase() && index !== editingIndex) ? Promise.reject(new Error('Bu SKU allaqachon mavjud')) : Promise.resolve() }]}>
            <TextControl placeholder="MAS-001-QORA-XL" maxLength={80} />
          </Form.Item>
          <div className={styles.modalGrid}>
            <Form.Item label="Narxi" name="price" rules={[{ required: true, message: 'Narxni kiriting' }]}>
              <NumberControl min={1} precision={0} addonAfter="so‘m" />
            </Form.Item>
            <Form.Item label="Eski narxi" name="oldPrice">
              <NumberControl min={0} precision={0} addonAfter="so‘m" />
            </Form.Item>
          </div>
          <Form.Item label="Shtrix-kod" name="barcode" rules={[{ max: 80 }]}>
            <TextControl placeholder="4780012345678" maxLength={80} />
          </Form.Item>
          <Form.Item label="Faol variant" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Ha" unCheckedChildren="Yo‘q" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
