import { Plus, Save, Trash2 } from 'lucide-react';
import { App, Button, Form, Select, Switch } from 'antd';
import type { FormInstance, UploadFile } from 'antd';
import { useMemo, useState } from 'react';
import type { ProductStatus, ProductUpsertPayload } from '../../model/productTypes';
import type { ProductVariant } from '../../model/productTypes';
import { ImageUpload } from '../../../../shared/ui/ImageUpload/ImageUpload';
import { VariantManager } from '../VariantManager/VariantManager';
import styles from './ProductForm.module.css';
import {
  NumberControl,
  TextAreaControl,
  TextControl,
} from '../../../../shared/ui/FormControls/FormControls';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { usePublicCategoriesQuery } from '../../../categories/api/categoryQueries';
import { createCategoryOptions } from '../../../categories/lib/categoryOptions';

export interface ProductFormValues {
  name: string;
  categoryId: string;
  description: string;
  price: number | null;
  oldPrice: number | null;
  status: Extract<ProductStatus, 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'OUT_OF_STOCK'>;
  attributes: Array<{ key: string; value: string }>;
  hasVariants: boolean;
  variants: ProductVariant[];
  imageUrl?: string | null;
  images?: string[];
}

interface ProductFormProps {
  form: FormInstance<ProductFormValues>;
  initialValues: ProductFormValues;
  submitting?: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (submission: ProductFormSubmission) => void;
}

export interface ProductFormSubmission {
  payload: ProductUpsertPayload;
  variants: ProductVariant[];
  uploads: Array<{ uid: string; file: File; isCover: boolean }>;
  updateUpload: (uid: string, patch: Partial<UploadFile>) => void;
}

function createInitialFiles(values: ProductFormValues): UploadFile[] {
  return [...new Set([values.imageUrl, ...(values.images ?? [])].filter(Boolean))].map(
    (url, index) => ({
      uid: `remote-${index}`,
      name: `product-image-${index + 1}`,
      status: 'done',
      url: url as string,
      thumbUrl: url as string,
      percent: 100,
    }),
  );
}

export function ProductForm({
  form,
  initialValues,
  submitting = false,
  submitLabel,
  onCancel,
  onSubmit,
}: ProductFormProps) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const categoriesQuery = usePublicCategoriesQuery();
  const categoryOptions = useMemo(
    () => createCategoryOptions(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );
  const initialFiles = useMemo(() => createInitialFiles(initialValues), [initialValues]);
  const [images, setImages] = useState<UploadFile[]>(initialFiles);
  const [coverUid, setCoverUid] = useState<string | null>(initialFiles[0]?.uid ?? null);
  const [variants, setVariants] = useState<ProductVariant[]>(initialValues.variants);
  const hasVariants = Form.useWatch('hasVariants', form) ?? initialValues.hasVariants;
  const price = Form.useWatch('price', form) ?? initialValues.price;

  const submit = (values: ProductFormValues) => {
    if (values.price === null) return;
    if (images.some((file) => file.status === 'uploading')) {
      void message.warning(t('product.waitImages'));
      return;
    }
    if (images.some((file) => file.status === 'error')) {
      void message.error(t('product.removeFailedImage'));
      return;
    }
    const imageEntries = images
      .map((file) => ({ uid: file.uid, url: file.url }))
      .filter((image): image is { uid: string; url: string } => Boolean(image.url));
    const coverImage = imageEntries.find(({ uid }) => uid === coverUid)?.url;
    const attributes = Object.fromEntries(
      values.attributes
        .map(({ key, value }) => [key.trim(), value.trim()] as const)
        .filter(([key, value]) => key && value),
    );

    const payload: ProductUpsertPayload = {
      categoryId: values.categoryId || null,
      name: values.name.trim(),
      description: values.description.trim(),
      price: values.price,
      oldPrice: values.oldPrice,
      imageUrl: coverImage ?? null,
      images: imageEntries.map(({ url }) => url),
      attributes,
      status: values.status,
    };
    onSubmit({
      payload,
      variants: values.hasVariants ? variants : [],
      uploads: images.flatMap((image) =>
        image.originFileObj && !image.url
          ? [{ uid: image.uid, file: image.originFileObj, isCover: image.uid === coverUid }]
          : [],
      ),
      updateUpload: (uid, patch) => {
        setImages((current) => current.map((image) => image.uid === uid ? { ...image, ...patch } : image));
      },
    });
  };

  return (
    <Form<ProductFormValues>
      name="product"
      form={form}
      layout="vertical"
      requiredMark
      initialValues={initialValues}
      className={styles.form}
      onFinish={submit}
    >
      <div className={styles.contentGrid}>
        <section className={styles.card} aria-labelledby="product-main-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="product-main-title">{t('product.mainInfo')}</h2>
              <p>{t('product.mainInfoDescription')}</p>
            </div>
          </div>

          <div className={styles.grid}>
            <Form.Item className={styles.fullWidth} label={t('product.name')} name="name" rules={[{ required: true, whitespace: true, message: t('product.nameRequired') }, { max: 120 }]}>
              <TextControl maxLength={120} placeholder={t('product.namePlaceholder')} />
            </Form.Item>
            <Form.Item
              label={t('product.category')}
              name="categoryId"
              validateStatus={categoriesQuery.isError ? 'warning' : undefined}
              help={categoriesQuery.isError ? t('product.categoriesLoadError') : undefined}
            >
              <Select
                allowClear
                showSearch
                virtual={false}
                loading={categoriesQuery.isPending}
                placeholder={t('product.selectCategory')}
                options={categoryOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item label={t('common.status')} name="status" rules={[{ required: true, message: t('product.statusRequired') }]}>
              <Select options={[{ value: 'DRAFT', label: t('status.draft') }, { value: 'ACTIVE', label: t('status.active') }, { value: 'ARCHIVED', label: t('status.archived') }, { value: 'OUT_OF_STOCK', label: t('status.outOfStock') }]} />
            </Form.Item>
            <Form.Item label={t('product.price')} name="price" rules={[{ required: true, message: t('product.priceRequired') }]}>
              <NumberControl min={1} precision={0} addonAfter={t('product.currency')} placeholder="14 999 000" />
            </Form.Item>
            <Form.Item label={t('product.oldPrice')} name="oldPrice" dependencies={['price']} rules={[({ getFieldValue }) => ({ validator(_, value: number | null) { const price = getFieldValue('price') as number | null; return value === null || price === null || value > price ? Promise.resolve() : Promise.reject(new Error(t('product.oldPriceInvalid'))); } })]}>
              <NumberControl min={1} precision={0} addonAfter={t('product.currency')} placeholder="15 999 000" />
            </Form.Item>
            <Form.Item label={t('product.hasVariants')} name="hasVariants" valuePropName="checked">
              <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
            </Form.Item>
            <Form.Item className={styles.fullWidth} label={t('product.descriptionLabel')} name="description" rules={[{ required: true, whitespace: true, message: t('product.descriptionRequired') }, { max: 2000 }]}>
              <TextAreaControl rows={4} maxLength={2000} showCount placeholder={t('product.descriptionPlaceholder')} />
            </Form.Item>
            <div className={styles.fullWidth}>
              <Form.List name="attributes">
                {(fields, { add, remove }) => (
                  <div className={styles.attributes}>
                    <div className={styles.attributesHeader}>
                      <div>
                        <strong>{t('product.attributes')}</strong>
                        <span>{t('product.attributesDescription')}</span>
                      </div>
                      <Button type="dashed" icon={<Plus size={16} />} onClick={() => add({ key: '', value: '' })}>
                        {t('product.addAttribute')}
                      </Button>
                    </div>
                    {fields.map((field) => (
                      <div className={styles.attributeRow} key={field.key}>
                        <Form.Item
                          {...field}
                          name={[field.name, 'key']}
                          rules={[{ required: true, whitespace: true, message: t('product.attributeNameRequired') }, { max: 80 }]}
                        >
                          <TextControl placeholder={t('product.attributeNamePlaceholder')} maxLength={80} />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'value']}
                          rules={[{ required: true, whitespace: true, message: t('product.attributeValueRequired') }, { max: 160 }]}
                        >
                          <TextControl placeholder={t('product.attributeValuePlaceholder')} maxLength={160} />
                        </Form.Item>
                        <Button
                          className={styles.removeAttribute}
                          type="text"
                          danger
                          aria-label={t('product.deleteAttribute')}
                          icon={<Trash2 size={17} />}
                          onClick={() => remove(field.name)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Form.List>
            </div>
            <VariantManager
              enabled={hasVariants}
              basePrice={price}
              value={variants}
              onChange={setVariants}
            />
          </div>
        </section>

        <section className={`${styles.card} ${styles.uploadCard}`} aria-labelledby="product-images-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="product-images-title">{t('product.images')}</h2>
              <p>{t('product.imagesDescription')}</p>
            </div>
          </div>
          <ImageUpload
            compact
            value={images}
            coverUid={coverUid ?? undefined}
            onChange={(nextImages) => {
              setImages(nextImages);
              setCoverUid((current) =>
                current && nextImages.some((file) => file.uid === current)
                  ? current
                  : nextImages[0]?.uid ?? null,
              );
            }}
            onCoverChange={setCoverUid}
          />
        </section>
      </div>

      <div className={styles.actions}>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="primary" htmlType="submit" icon={<Save />} loading={submitting} disabled={images.some((file) => file.status === 'uploading')}>{submitLabel ?? t('product.save')}</Button>
      </div>
    </Form>
  );
}
