import { Form } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { initialProducts } from '../../features/seller/model/sellerData';
import { ProductForm, type ProductFormValues } from '../../features/seller/ui/ProductForm/ProductForm';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './ProductEditorPage.module.css';

const emptyProduct: ProductFormValues = {
  name: '', sku: '', category: '', price: 0, stock: 0, variants: [],
};

export default function ProductEditorPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [form] = Form.useForm<ProductFormValues>();
  const product = productId ? initialProducts.find(({ id }) => id === productId) : undefined;
  const isEditing = Boolean(productId);
  const initialValues: ProductFormValues = product
    ? { name: product.name, sku: product.sku, category: product.category, price: product.price, stock: product.stock, variants: product.variants }
    : emptyProduct;

  const handleSubmit = () => {
    // Product API ulanadigan tayyor yagona submit nuqtasi.
    void navigate('/products', { replace: true });
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title={isEditing ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
        description={isEditing ? 'Mahsulot ma’lumotlari va variantlarini yangilang.' : 'Katalog uchun yangi mahsulot ma’lumotlarini kiriting.'}
      />
      <ProductForm
        form={form}
        initialValues={initialValues}
        submitLabel={isEditing ? 'O‘zgarishlarni saqlash' : 'Mahsulotni yaratish'}
        onCancel={() => void navigate('/products')}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
