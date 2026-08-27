import { App, Form } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ProductForm, type ProductFormSubmission, type ProductFormValues } from '../../features/products/ui/ProductForm/ProductForm';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { useCreateProductMutation, useProductQuery, useUpdateProductMutation } from '../../features/products/api/productQueries';
import { productKeys } from '../../features/products/api/productQueries';
import { uploadFile } from '../../shared/api/fileApi';
import { createProductVariant, deleteProductVariant, updateProductVariant } from '../../features/products/api/productVariantApi';
import styles from './ProductEditorPage.module.css';
import { BackButton } from '../../shared/ui/BackButton/BackButton';

const emptyProduct: ProductFormValues = {
  name: '', categoryId: '', description: '', price: null, oldPrice: null,
  attributes: [], hasVariants: false, variants: [], images: [], imageUrl: null,
};

export default function ProductEditorPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { productId } = useParams();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<ProductFormValues>();
  const [saving, setSaving] = useState(false);
  const createdDraftId = useRef<string | null>(null);
  const isEditing = Boolean(productId);
  const productQuery = useProductQuery(productId);
  const createMutation = useCreateProductMutation();
  const updateMutation = useUpdateProductMutation(productId ?? '');
  const product = productQuery.data;
  const initialValues: ProductFormValues = product
    ? {
        name: product.name,
        categoryId: product.categoryId,
        description: product.description,
        price: product.price,
        oldPrice: product.oldPrice,
        attributes: Object.entries(product.attributes).map(([key, value]) => ({ key, value })),
        hasVariants: product.hasVariants,
        variants: product.variants,
        imageUrl: product.imageUrl,
        images: product.images,
      }
    : emptyProduct;

  const handleSubmit = async ({ payload, variants, uploads, updateUpload }: ProductFormSubmission) => {
    setSaving(true);
    try {
      let targetProductId = productId ?? createdDraftId.current;
      if (productId) {
        await updateMutation.mutateAsync(payload);
      } else if (!targetProductId) {
        const created = await createMutation.mutateAsync({ ...payload, imageUrl: undefined, images: [] });
        targetProductId = created.id;
        createdDraftId.current = created.id;
      }
      if (!targetProductId) throw new Error('Mahsulot IDsi olinmadi');

      await Promise.all(uploads.map(async (upload) => {
        updateUpload(upload.uid, { status: 'uploading', percent: 1 });
        try {
          const url = await uploadFile(upload.file, targetProductId, upload.isCover, (percent) => {
            updateUpload(upload.uid, { status: 'uploading', percent });
          });
          updateUpload(upload.uid, { status: 'done', percent: 100, url });
        } catch (error) {
          updateUpload(upload.uid, { status: 'error', percent: 0 });
          throw error;
        }
      }));

      const initialVariants = product?.variants ?? [];
      const retainedIds = new Set(variants.flatMap((variant) => variant.id ? [variant.id] : []));
      const deletedVariantIds = initialVariants.flatMap((variant) =>
        variant.id && !retainedIds.has(variant.id) ? [variant.id] : [],
      );
      await Promise.all(deletedVariantIds.map((variantId) =>
        deleteProductVariant(targetProductId, variantId),
      ));
      await Promise.all(variants.map(async (variant) => {
        const variantPayload = {
          sku: variant.sku,
          name: variant.name || '',
          attributes: variant.attributes,
          price: variant.price,
          oldPrice: variant.oldPrice,
          barcode: variant.barcode || '',
          imageUrl: variant.imageUrl,
          isActive: variant.isActive,
        };
        if (variant.id) await updateProductVariant(targetProductId, variant.id, variantPayload);
        else await createProductVariant(targetProductId, variantPayload);
      }));

      await queryClient.invalidateQueries({ queryKey: productKeys.mine() });
      void message.success(isEditing ? 'Mahsulot yangilandi' : 'Mahsulot yaratildi');
      void navigate('/products', { replace: true });
    } catch (error) {
      void message.error(getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (isEditing && productQuery.isPending) return <ContentState state="loading" />;
  if (isEditing && productQuery.isError) {
    return <ContentState state="error" title="Mahsulotni yuklab bo‘lmadi" description={getAuthErrorMessage(productQuery.error)} onAction={() => void productQuery.refetch()} />;
  }

  return (
    <main className={styles.page}>
      <PageHeader
        before={<BackButton fallback="/products" disabled={saving} />}
        title={isEditing ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
        description={isEditing ? 'Mahsulot ma’lumotlari va variantlarini yangilang.' : 'Katalog uchun yangi mahsulot ma’lumotlarini kiriting.'}
      />
      <ProductForm
        form={form}
        initialValues={initialValues}
        submitting={saving || createMutation.isPending || updateMutation.isPending}
        submitLabel={isEditing ? 'O‘zgarishlarni saqlash' : 'Mahsulotni yaratish'}
        onCancel={() => void navigate('/products')}
        onSubmit={(submission) => void handleSubmit(submission)}
      />
    </main>
  );
}
