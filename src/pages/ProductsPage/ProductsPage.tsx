import {
  Download,
  Filter,
  Image as PictureOutlined,
  Pencil as EditOutlined,
  Plus as PlusOutlined,
  Trash2 as DeleteOutlined,
  Upload,
} from 'lucide-react';
import { App, Card, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../../features/products/model/productTypes';
import { useDeleteProductMutation, useMyProductsQuery } from '../../features/products/api/productQueries';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { MoneyText } from '../../shared/ui/MoneyText/MoneyText';
import styles from './ProductsPage.module.css';
import { ListToolbar } from '../../shared/ui/ListToolbar/ListToolbar';
import { FilterTabs } from '../../shared/ui/FilterTabs/FilterTabs';
import { ToolbarButton } from '../../shared/ui/ToolbarButton/ToolbarButton';
import { ActionMenu } from '../../shared/ui/ActionMenu/ActionMenu';
import { SummaryCard } from '../../shared/ui/SummaryCard/SummaryCard';
import { normalizeSearchText } from '../../shared/lib/search';
import { ContentState } from '../../shared/ui/ContentState/ContentState';

type ProductStatusFilter = 'ALL' | Product['status'];
const EMPTY_PRODUCTS: Product[] = [];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Barcha mahsulotlar' },
  { value: 'ACTIVE', label: 'Faol' },
  { value: 'LOW', label: 'Kam qoldiq' },
  { value: 'INACTIVE', label: 'Nofaol' },
] as const satisfies readonly { value: ProductStatusFilter; label: string }[];

export default function ProductsPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const productsQuery = useMyProductsQuery();
  const deleteMutation = useDeleteProductMutation();
  const products = productsQuery.data ?? EMPTY_PRODUCTS;
  const [status, setStatus] = useState<ProductStatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (status === 'ALL' || product.status === status) &&
          normalizeSearchText(`${product.name} ${product.sku}`).includes(
            normalizeSearchText(query),
          ),
      ),
    [products, query, status],
  );

  const activeCount = products.filter(({ status: value }) => value === 'ACTIVE').length;
  const lowStockCount = products.filter(({ status: value }) => value === 'LOW').length;

  const removeProduct = (product: Product) => {
    deleteMutation.mutate(product.id, {
      onSuccess: () => {
        setDeletingProduct(null);
        void message.success('Mahsulot o‘chirildi');
      },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  if (productsQuery.isPending) return <ContentState state="loading" />;
  if (productsQuery.isError) {
    return <ContentState state="error" title="Mahsulotlarni yuklab bo‘lmadi" description={getAuthErrorMessage(productsQuery.error)} onAction={() => void productsQuery.refetch()} />;
  }

  const columns: ColumnsType<Product> = [
    {
      title: '',
      width: 64,
      render: () => <span className={styles.imagePlaceholder}><PictureOutlined /></span>,
    },
    { title: 'Nomi', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (name: string) => <Typography.Text strong>{name}</Typography.Text> },
    { title: 'SKU', dataIndex: 'sku', width: 120 },
    { title: 'Kategoriya', dataIndex: 'category' },
    { title: 'Narxi', dataIndex: 'price', render: (price: number) => <MoneyText value={price} />, sorter: (a, b) => a.price - b.price },
    { title: 'Qoldiq', dataIndex: 'stock', width: 100, sorter: (a, b) => a.stock - b.stock },
    { title: 'Holati', dataIndex: 'status', render: (status: Product['status']) => <StatusTag status={status} /> },
    {
      title: 'Amallar',
      width: 110,
      render: (_, product) => (
        <ActionMenu
          ariaLabel={`${product.name} amallari`}
          items={[
            {
              key: 'edit',
              label: 'Tahrirlash',
              icon: <EditOutlined />,
              onClick: () => void navigate(`/products/${product.id}/edit`),
            },
            {
              key: 'delete',
              label: 'O‘chirish',
              icon: <DeleteOutlined />,
              danger: true,
              onClick: () => setDeletingProduct(product),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <Typography.Title level={1} className={styles.srOnly}>
        Mahsulotlar
      </Typography.Title>
      <ListToolbar
        value={query}
        placeholder="Mahsulot yoki SKU qidirish..."
        onChange={setQuery}
        actions={
          <>
          <ToolbarButton icon={<Filter />}>Filter</ToolbarButton>
          <ToolbarButton icon={<Download />} onClick={() => void message.info('Eksport tayyorlanmoqda')}>Eksport</ToolbarButton>
          <ToolbarButton icon={<Upload />} onClick={() => void message.info('Import oynasi tayyorlanmoqda')}>Import</ToolbarButton>
          <ToolbarButton type="primary" icon={<PlusOutlined />} onClick={() => void navigate('/products/new')}>
            Mahsulot qo‘shish
          </ToolbarButton>
          </>
        }
      />

      <section className={styles.stats} aria-label="Mahsulot statistikasi">
        <SummaryCard title="Jami mahsulotlar" value={products.length} caption="Katalogdagi barcha mahsulotlar" icon={<PictureOutlined />} />
        <SummaryCard title="Faol mahsulotlar" value={activeCount} caption="Sotuv uchun faol holatda" icon={<PictureOutlined />} tone="success" />
        <SummaryCard title="Kam qolgan" value={lowStockCount} caption="Qoldiqni yangilash talab qilinadi" icon={<PictureOutlined />} tone="warning" />
      </section>

      <Card className={styles.tableCard}>
        <FilterTabs
          value={status}
          options={STATUS_FILTERS}
          ariaLabel="Mahsulot holati"
          onChange={setStatus}
        />
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={filteredProducts}
          scroll={{ x: 900 }}
          pagination={createTablePagination(8)}
        />
      </Card>
      <ConfirmDialog
        open={Boolean(deletingProduct)}
        title="Mahsulot o‘chirilsinmi?"
        description={`${deletingProduct?.name ?? 'Mahsulot'} ro‘yxatdan olib tashlanadi.`}
        confirmText="O‘chirish"
        danger
        loading={deleteMutation.isPending}
        onCancel={() => setDeletingProduct(null)}
        onConfirm={() => {
          if (deletingProduct) removeProduct(deletingProduct);
        }}
      />
    </main>
  );
}
