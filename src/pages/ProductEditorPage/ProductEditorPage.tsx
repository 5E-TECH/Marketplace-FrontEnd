import { App, Form } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ProductForm, type ProductFormSubmission, type ProductFormValues } from '../../features/products/ui/ProductForm/ProductForm';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { useCreateProductMutation, useProductQuery, useUpdateProductMutation } from '../../features/products/api/productQueries';
import { updateProduct } from '../../features/products/api/productApi';
import { productKeys } from '../../features/products/api/productQueries';
import { uploadFile } from '../../shared/api/fileApi';
import { createProductVariant, deleteProductVariant, updateProductVariant } from '../../features/products/api/productVariantApi';
import styles from './ProductEditorPage.module.css';
import { BackButton } from '../../shared/ui/BackButton/BackButton';
import { useTranslation } from '../../shared/i18n/useTranslation';

const emptyProduct: ProductFormValues = {
  name: '', categoryId: '', description: '', price: null, oldPrice: null,
  attributes: [], hasVariants: false, variants: [], images: [], imageUrl: null, status: 'DRAFT',
};

export default function ProductEditorPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { productId } = useParams();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<ProductFormValues>();
  const [saving, setSaving] = useState(false);
  const createdDraftId = useRef<string | null>(null);
  const deletedVariants = useRef(new Set<string>());
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
        status: ['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'].includes(product.status) ? product.status as ProductFormValues['status'] : 'DRAFT',
        attributes: Object.entries(product.attributes).map(([key, value]) => ({ key, value })),
        hasVariants: product.hasVariants,
        variants: product.variants,
        imageUrl: product.imageUrl,
        images: product.images,
      }
    : emptyProduct;

  const handleSubmit = async ({ payload, variants, uploads, updateUpload, updateVariantId }: ProductFormSubmission) => {
    if (saving) return;
    setSaving(true);
    try {
      let targetProductId = productId ?? createdDraftId.current;
      if (productId) {
        await updateMutation.mutateAsync(payload);
      } else if (!targetProductId) {
        const created = await createMutation.mutateAsync({ ...payload, imageUrl: null, images: [] });
        targetProductId = created.id;
        createdDraftId.current = created.id;
      } else {
        await updateProduct(targetProductId, payload);
      }
      if (!targetProductId) throw new Error(t('product.idMissing'));

      const uploadResults = await Promise.allSettled(uploads.map(async (upload) => {
        updateUpload(upload.uid, { status: 'uploading', percent: 1 });
        try {
          const url = await uploadFile({ file: upload.file, productId: targetProductId, isCover: upload.isCover }, (percent) => {
            updateUpload(upload.uid, { status: 'uploading', percent });
          });
          updateUpload(upload.uid, { status: 'done', percent: 100, url });
        } catch (error) {
          updateUpload(upload.uid, { status: 'error', percent: 0 });
          throw error;
        }
      }));

      const failedUpload = uploadResults.find((result) => result.status === 'rejected');
      if (failedUpload?.status === 'rejected') throw failedUpload.reason;

      const initialVariants = product?.hasVariants ? product.variants : [];
      const retainedIds = new Set(variants.flatMap((variant) => variant.id ? [variant.id] : []));
      const deletedVariantIds = initialVariants.flatMap((variant) =>
        variant.id && !retainedIds.has(variant.id) && !deletedVariants.current.has(variant.id) ? [variant.id] : [],
      );
      for (const variantId of deletedVariantIds) {
        await deleteProductVariant(targetProductId, variantId);
        deletedVariants.current.add(variantId);
      }
      for (const variant of variants) {
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
        else {
          const id = await createProductVariant(targetProductId, variantPayload);
          updateVariantId(variant.sku, id);
        }
      }

      queryClient.removeQueries({ queryKey: productKeys.detail(targetProductId), exact: true });

      await queryClient.invalidateQueries({ queryKey: productKeys.mine() });
      void message.success(isEditing ? t('product.updated') : t('product.created'));
      void navigate('/products', { replace: true });
    } catch (error) {
      void message.error(getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (isEditing && productQuery.isPending) return <ContentState state="loading" />;
  if (isEditing && productQuery.isError) {
    return <ContentState state="error" title={t('product.loadError')} description={getAuthErrorMessage(productQuery.error)} onAction={() => void productQuery.refetch()} />;
  }

  return (
    <main className={styles.page}>
      <PageHeader
        before={<BackButton fallback="/products" disabled={saving} />}
        title={isEditing ? t('product.editTitle') : t('product.newTitle')}
        description={isEditing ? t('product.editDescription') : t('product.newDescription')}
      />
      <ProductForm
        form={form}
        initialValues={initialValues}
        submitting={saving || createMutation.isPending || updateMutation.isPending}
        submitLabel={isEditing ? t('product.saveChanges') : t('product.create')}
        onCancel={() => void navigate('/products')}
        onSubmit={(submission) => void handleSubmit(submission)}
      />
    </main>
  );
}
