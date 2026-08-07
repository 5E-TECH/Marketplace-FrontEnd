import { App, Form } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ProductForm, type ProductFormValues } from '../../features/products/ui/ProductForm/ProductForm';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { useCreateProductMutation, useProductQuery, useUpdateProductMutation } from '../../features/products/api/productQueries';
import styles from './ProductEditorPage.module.css';

const emptyProduct: ProductFormValues = {
  name: '', sku: '', category: '', price: 0, stock: 0,
};

export default function ProductEditorPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { productId } = useParams();
  const [form] = Form.useForm<ProductFormValues>();
  const isEditing = Boolean(productId);
  const productQuery = useProductQuery(productId);
  const createMutation = useCreateProductMutation();
  const updateMutation = useUpdateProductMutation(productId ?? '');
  const product = productQuery.data;
  const initialValues: ProductFormValues = product
    ? { name: product.name, sku: product.sku, category: product.category, price: product.price, stock: product.stock }
    : emptyProduct;

  const handleSubmit = (values: ProductFormValues) => {
    const mutation = isEditing ? updateMutation : createMutation;
    mutation.mutate({
      ...values,
      name: values.name.trim(),
      sku: values.sku.trim(),
    }, {
      onSuccess: () => {
        void message.success(isEditing ? 'Mahsulot yangilandi' : 'Mahsulot yaratildi');
        void navigate('/products', { replace: true });
      },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  if (isEditing && productQuery.isPending) return <ContentState state="loading" />;
  if (isEditing && productQuery.isError) {
    return <ContentState state="error" title="Mahsulotni yuklab bo‘lmadi" description={getAuthErrorMessage(productQuery.error)} onAction={() => void productQuery.refetch()} />;
  }

  return (
    <main className={styles.page}>
      <PageHeader
        title={isEditing ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
        description={isEditing ? 'Mahsulot ma’lumotlari va variantlarini yangilang.' : 'Katalog uchun yangi mahsulot ma’lumotlarini kiriting.'}
      />
      <ProductForm
        form={form}
        initialValues={initialValues}
        submitting={createMutation.isPending || updateMutation.isPending}
        submitLabel={isEditing ? 'O‘zgarishlarni saqlash' : 'Mahsulotni yaratish'}
        onCancel={() => void navigate('/products')}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
