import { Plus, Save, Trash2 } from 'lucide-react';
import { App, Button, Form, Select, Switch, TreeSelect } from 'antd';
import type { FormInstance, UploadFile } from 'antd';
import { useMemo, useState } from 'react';
import type { ProductStatus, ProductUpsertPayload } from '../../model/productTypes';
import type { ProductVariant } from '../../model/productTypes';
import { usePublicCategoriesQuery } from '../../../categories/api/categoryQueries';
import type { Category } from '../../../categories/model/categoryTypes';
import { ImageUpload } from '../../../../shared/ui/ImageUpload/ImageUpload';
import { VariantManager } from '../VariantManager/VariantManager';
import styles from './ProductForm.module.css';
import {
  NumberControl,
  TextAreaControl,
  TextControl,
} from '../../../../shared/ui/FormControls/FormControls';

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

/**
 * Kategoriya daraxtini TreeSelect kutgan shaklga o'giradi. Faol bo'lmagan
 * kategoriya tanlanmaydi, lekin ko'rinib turadi — chunki tahrirlanayotgan eski
 * mahsulot o'sha kategoriyada bo'lishi mumkin.
 */
function toCategoryTreeData(categories: Category[]): Array<{
  value: string;
  title: string;
  disabled: boolean;
  children: ReturnType<typeof toCategoryTreeData>;
}> {
  return categories.map((category) => ({
    value: category.id,
    title: category.name,
    disabled: !category.isActive,
    children: toCategoryTreeData(category.children),
  }));
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
  submitLabel = 'Mahsulotni saqlash',
  onCancel,
  onSubmit,
}: ProductFormProps) {
  const { message } = App.useApp();
  const initialFiles = useMemo(() => createInitialFiles(initialValues), [initialValues]);
  const [images, setImages] = useState<UploadFile[]>(initialFiles);
  const [coverUid, setCoverUid] = useState<string | null>(initialFiles[0]?.uid ?? null);
  const [variants, setVariants] = useState<ProductVariant[]>(initialValues.variants);
  const hasVariants = Form.useWatch('hasVariants', form) ?? initialValues.hasVariants;
  const price = Form.useWatch('price', form) ?? initialValues.price;
  const categoriesQuery = usePublicCategoriesQuery();
  const categoryTreeData = useMemo(
    () => toCategoryTreeData(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  const submit = (values: ProductFormValues) => {
    if (values.price === null) return;
    if (images.some((file) => file.status === 'uploading')) {
      void message.warning('Rasmlar yuklanib bo‘lishini kuting');
      return;
    }
    if (images.some((file) => file.status === 'error')) {
      void message.error('Yuklanmagan rasmni o‘chiring yoki qayta yuklang');
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
              <h2 id="product-main-title">Asosiy ma’lumotlar</h2>
              <p>API product contractidagi katalog ma’lumotlarini kiriting.</p>
            </div>
          </div>

          <div className={styles.grid}>
            <Form.Item className={styles.fullWidth} label="Mahsulot nomi" name="name" rules={[{ required: true, whitespace: true, message: 'Mahsulot nomini kiriting' }, { max: 120 }]}>
              <TextControl maxLength={120} placeholder="Masalan, iPhone 16 Pro" />
            </Form.Item>
            <Form.Item
              label="Kategoriya"
              name="categoryId"
              validateStatus={categoriesQuery.isError ? 'warning' : undefined}
              help={categoriesQuery.isError ? 'Kategoriyalarni yuklab bo‘lmadi — sahifani yangilang' : undefined}
            >
              <TreeSelect
                treeData={categoryTreeData}
                loading={categoriesQuery.isPending}
                disabled={categoriesQuery.isPending || categoriesQuery.isError}
                placeholder={categoriesQuery.isPending ? 'Yuklanmoqda…' : 'Kategoriyani tanlang'}
                showSearch
                treeNodeFilterProp="title"
                treeDefaultExpandAll
                allowClear
                notFoundContent="Kategoriya topilmadi"
              />
            </Form.Item>
            <Form.Item label="Holati" name="status" rules={[{ required: true, message: 'Mahsulot holatini tanlang' }]}>
              <Select options={[{ value: 'DRAFT', label: 'Qoralama' }, { value: 'ACTIVE', label: 'Faol' }, { value: 'ARCHIVED', label: 'Arxivlangan' }, { value: 'OUT_OF_STOCK', label: 'Sotuvda yo‘q' }]} />
            </Form.Item>
            <Form.Item label="Narxi" name="price" rules={[{ required: true, message: 'Narxni kiriting' }]}>
              <NumberControl min={1} precision={0} addonAfter="so‘m" placeholder="14 999 000" />
            </Form.Item>
            <Form.Item label="Eski narxi" name="oldPrice" dependencies={['price']} rules={[({ getFieldValue }) => ({ validator(_, value: number | null) { const price = getFieldValue('price') as number | null; return value === null || price === null || value > price ? Promise.resolve() : Promise.reject(new Error('Eski narx amaldagi narxdan katta bo‘lishi kerak')); } })]}>
              <NumberControl min={1} precision={0} addonAfter="so‘m" placeholder="15 999 000" />
            </Form.Item>
            <Form.Item label="Variantlar mavjud" name="hasVariants" valuePropName="checked">
              <Switch checkedChildren="Ha" unCheckedChildren="Yo‘q" />
            </Form.Item>
            <Form.Item className={styles.fullWidth} label="Tavsif" name="description" rules={[{ required: true, whitespace: true, message: 'Mahsulot tavsifini kiriting' }, { max: 2000 }]}>
              <TextAreaControl rows={4} maxLength={2000} showCount placeholder="Mahsulotning muhim xususiyatlarini yozing" />
            </Form.Item>
            <div className={styles.fullWidth}>
              <Form.List name="attributes">
                {(fields, { add, remove }) => (
                  <div className={styles.attributes}>
                    <div className={styles.attributesHeader}>
                      <div>
                        <strong>Qo‘shimcha xususiyatlar</strong>
                        <span>Istalgan mahsulotga mos nom va qiymat kiriting.</span>
                      </div>
                      <Button type="dashed" icon={<Plus size={16} />} onClick={() => add({ key: '', value: '' })}>
                        Xususiyat qo‘shish
                      </Button>
                    </div>
                    {fields.map((field) => (
                      <div className={styles.attributeRow} key={field.key}>
                        <Form.Item
                          {...field}
                          name={[field.name, 'key']}
                          rules={[{ required: true, whitespace: true, message: 'Xususiyat nomini kiriting' }, { max: 80 }]}
                        >
                          <TextControl placeholder="Masalan, Rang" maxLength={80} />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'value']}
                          rules={[{ required: true, whitespace: true, message: 'Qiymatni kiriting' }, { max: 160 }]}
                        >
                          <TextControl placeholder="Masalan, Qora" maxLength={160} />
                        </Form.Item>
                        <Button
                          className={styles.removeAttribute}
                          type="text"
                          danger
                          aria-label="Xususiyatni o‘chirish"
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
              <h2 id="product-images-title">Mahsulot rasmlari</h2>
              <p>Cover rasmni belgilang va tartibni drag orqali o‘zgartiring.</p>
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
        <Button onClick={onCancel}>Bekor qilish</Button>
        <Button type="primary" htmlType="submit" icon={<Save />} loading={submitting} disabled={images.some((file) => file.status === 'uploading')}>{submitLabel}</Button>
      </div>
    </Form>
  );
}
