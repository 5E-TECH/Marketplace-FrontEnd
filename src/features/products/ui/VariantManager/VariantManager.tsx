import { Button, Form, Modal, Popconfirm, Switch, Tag } from 'antd';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ProductVariant } from '../../model/productTypes';
import { NumberControl, TextControl } from '../../../../shared/ui/FormControls/FormControls';
import styles from './VariantManager.module.css';
import { formatMoney } from '../../../../shared/ui/MoneyText/formatMoney';
import { DataTable } from '../../../../shared/ui/DataTable/DataTable';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { useTranslation } from '../../../../shared/i18n/useTranslation';

interface VariantManagerProps {
  enabled: boolean;
  basePrice: number | null;
  value?: ProductVariant[];
  onChange?: (variants: ProductVariant[]) => void;
}

type VariantFormValues = Omit<ProductVariant, 'attributes'> & {
  attributeEntries: Array<{ key: string; value: string }>;
};

export function VariantManager({ enabled, basePrice, value = [], onChange }: VariantManagerProps) {
  const { t } = useTranslation();
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
    form.setFieldsValue({ name: '', sku: '', price: basePrice, oldPrice: null, barcode: '', attributeEntries: [], imageUrl: null, isActive: true });
    setOpen(true);
  };

  const editVariant = (variant: ProductVariant, index: number) => {
    setEditingIndex(index);
    form.setFieldsValue({
      ...variant,
      attributeEntries: Object.entries(variant.attributes).map(([key, value]) => ({ key, value })),
    });
    setOpen(true);
  };

  const save = (values: VariantFormValues) => {
    const normalized: ProductVariant = {
      ...values,
      name: values.name.trim(),
      sku: values.sku.trim(),
      attributes: Object.fromEntries(
        (values.attributeEntries ?? [])
          .map(({ key, value }) => [key.trim(), value.trim()] as const)
          .filter(([key, value]) => key && value),
      ),
      imageUrl: values.imageUrl?.trim() || null,
    };
    delete (normalized as ProductVariant & { attributeEntries?: unknown }).attributeEntries;
    onChange?.(
      editingIndex === null
        ? [...value, normalized]
        : value.map((item, index) => (index === editingIndex ? normalized : item)),
    );
    close();
  };

  if (!enabled) {
    return (
      <section className={styles.defaultVariant} aria-label={t('variant.default')}>
        <div>
          <Tag color="default">DEFAULT</Tag>
          <strong>{t('variant.default')}</strong>
          <span>{t('variant.defaultDescription')}</span>
        </div>
        <b>{basePrice ? `${formatMoney(basePrice)} ${t('product.currency')}` : t('variant.noPrice')}</b>
      </section>
    );
  }

  return (
    <section className={styles.manager} aria-labelledby="variants-title">
      <div className={styles.header}>
        <div>
          <h3 id="variants-title">{t('variant.title')}</h3>
          <p>{t('variant.description')}</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={addVariant}>{t('variant.add')}</Button>
      </div>

      <DataTable<ProductVariant>
        rowKey={(variant) => `${variant.sku}-${variant.name}`}
        dataSource={value}
        pagination={false}
        emptyState={<EmptyState compact title={t('variant.empty')} description="" />}
        columns={[
          { title: t('variant.variant'), dataIndex: 'name' },
          { title: 'SKU', dataIndex: 'sku', responsive: ['sm'], render: (sku: string) => <code>{sku}</code> },
          { title: t('product.price'), dataIndex: 'price', align: 'right', render: (price: number | null) => price === null ? t('variant.basePrice') : `${formatMoney(price)} ${t('product.currency')}` },
          { title: t('common.status'), dataIndex: 'isActive', align: 'center', responsive: ['md'], render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? t('status.active') : t('status.inactive')}</Tag> },
          {
            title: '', width: 92, align: 'right',
            render: (_value, variant, index) => (
              <div className={styles.actions}>
                <Button type="text" aria-label={t('variant.editAria', { name: variant.name })} icon={<Pencil size={16} />} onClick={() => editVariant(variant, index)} />
                <Popconfirm title={t('variant.deleteTitle')} okText={t('common.delete')} cancelText={t('common.cancel')} onConfirm={() => onChange?.(value.filter((_item, itemIndex) => itemIndex !== index))}>
                  <Button type="text" danger aria-label={t('variant.deleteAria', { name: variant.name })} icon={<Trash2 size={16} />} />
                </Popconfirm>
              </div>
            ),
          },
        ]}
      />

      <Modal title={editingIndex === null ? t('variant.new') : t('variant.edit')} open={open} okText={t('common.save')} cancelText={t('common.cancel')} onCancel={close} onOk={() => form.submit()} destroyOnHidden>
        <Form<VariantFormValues> name="productVariant" form={form} layout="vertical" onFinish={save} className={styles.modalForm}>
          <Form.Item label={t('variant.name')} name="name" rules={[{ required: true, whitespace: true, message: t('variant.nameRequired') }, { max: 100 }]}>
            <TextControl placeholder={t('variant.namePlaceholder')} maxLength={100} />
          </Form.Item>
          <Form.Item label="SKU" name="sku" rules={[{ required: true, whitespace: true, message: t('variant.skuRequired') }, { max: 80 }, { validator: (_, sku: string) => value.some((item, index) => item.sku.toLowerCase() === sku?.trim().toLowerCase() && index !== editingIndex) ? Promise.reject(new Error(t('variant.skuExists'))) : Promise.resolve() }]}>
            <TextControl placeholder="MAS-001-QORA-XL" maxLength={80} />
          </Form.Item>
          <div className={styles.modalGrid}>
            <Form.Item label={t('product.price')} name="price" rules={[{ required: true, message: t('product.priceRequired') }]}>
              <NumberControl min={1} precision={0} addonAfter={t('product.currency')} />
            </Form.Item>
            <Form.Item label={t('product.oldPrice')} name="oldPrice">
              <NumberControl min={0} precision={0} addonAfter={t('product.currency')} />
            </Form.Item>
          </div>
          <Form.Item label={t('variant.barcode')} name="barcode" rules={[{ max: 80 }]}>
            <TextControl placeholder="4780012345678" maxLength={80} />
          </Form.Item>
          <Form.Item label={t('variant.imageUrl')} name="imageUrl" rules={[{ type: 'url' }]}>
            <TextControl placeholder="https://cdn.example.com/product.jpg" maxLength={500} />
          </Form.Item>
          <div className={styles.attributesHeading}>
            <strong>{t('variant.attributes')}</strong>
            <span>{t('variant.attributesDescription')}</span>
          </div>
          <Form.List name="attributeEntries">
            {(fields, { add, remove }) => (
              <div className={styles.attributeList}>
                {fields.map((field) => (
                  <div className={styles.attributeRow} key={field.key}>
                    <Form.Item {...field} name={[field.name, 'key']} rules={[{ required: true, whitespace: true, message: t('product.attributeNameRequired') }]}>
                      <TextControl placeholder={t('product.attributeNamePlaceholder')} maxLength={80} />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'value']} rules={[{ required: true, whitespace: true, message: t('product.attributeValueRequired') }]}>
                      <TextControl placeholder={t('product.attributeValuePlaceholder')} maxLength={160} />
                    </Form.Item>
                    <Button type="text" danger aria-label={t('product.deleteAttribute')} icon={<Trash2 size={16} />} onClick={() => remove(field.name)} />
                  </div>
                ))}
                <Button type="dashed" block icon={<Plus size={16} />} onClick={() => add({ key: '', value: '' })}>{t('product.addAttribute')}</Button>
              </div>
            )}
          </Form.List>
          <Form.Item label={t('variant.active')} name="isActive" valuePropName="checked">
            <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
