import {
  Download,
  Image as PictureOutlined,
  Pencil as EditOutlined,
  Plus as PlusOutlined,
  SlidersHorizontal,
  Trash2 as DeleteOutlined,
  Upload,
} from 'lucide-react';
import { App, Button, Card, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useMemo, useState } from 'react';
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
import { ToolbarButton } from '../../shared/ui/ToolbarButton/ToolbarButton';
import { ActionMenu } from '../../shared/ui/ActionMenu/ActionMenu';
import { SummaryCard } from '../../shared/ui/SummaryCard/SummaryCard';
import { ContentState } from '../../shared/ui/ContentState/ContentState';

type ProductStatusFilter = 'ALL' | Product['status'];
const EMPTY_PRODUCTS: Product[] = [];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Barcha holatlar' },
  { value: 'DRAFT', label: 'Qoralama' },
  { value: 'ACTIVE', label: 'Faol' },
  { value: 'OUT_OF_STOCK', label: 'Sotuvda yo‘q' },
  { value: 'ARCHIVED', label: 'Arxivlangan' },
] as const satisfies readonly { value: ProductStatusFilter; label: string }[];

export default function ProductsPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ProductStatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query.trim());
  const productsQuery = useMyProductsQuery({
    page,
    limit: 8,
    ...(deferredQuery ? { search: deferredQuery } : {}),
    ...(status !== 'ALL' && ['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'].includes(status) ? { status: status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'OUT_OF_STOCK' } : {}),
  });
  const deleteMutation = useDeleteProductMutation();
  const products = productsQuery.data?.items ?? EMPTY_PRODUCTS;
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const { activeCount, lowStockCount } = useMemo(
    () =>
      products.reduce(
        (counts, product) => {
          if (product.status === 'ACTIVE') counts.activeCount += 1;
          if (product.status === 'OUT_OF_STOCK') counts.lowStockCount += 1;
          return counts;
        },
        { activeCount: 0, lowStockCount: 0 },
      ),
    [products],
  );

  const removeProduct = (product: Product) => {
    deleteMutation.mutate(product.id, {
      onSuccess: () => {
        setDeletingProduct(null);
        if (products.length === 1 && page > 1) setPage((current) => current - 1);
        void message.success('Mahsulot o‘chirildi');
      },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  if (productsQuery.isPending) {
    return (
      <main className={styles.page}>
        <Typography.Title level={1} className={styles.srOnly}>
          Mahsulotlar
        </Typography.Title>
        <ContentState state="loading" />
      </main>
    );
  }
  if (productsQuery.isError) {
    return (
      <main className={styles.page}>
        <Typography.Title level={1} className={styles.srOnly}>
          Mahsulotlar
        </Typography.Title>
        <ContentState
          state="error"
          title="Mahsulotlarni yuklab bo‘lmadi"
          description={getAuthErrorMessage(productsQuery.error)}
          onAction={() => void productsQuery.refetch()}
        />
      </main>
    );
  }

  const columns: ColumnsType<Product> = [
    {
      title: '',
      width: 76,
      render: (_, product) => product.imageUrl
        ? <img className={styles.productImage} src={product.imageUrl} alt="" loading="lazy" />
        : <span className={styles.imagePlaceholder}><PictureOutlined /></span>,
    },
    { title: 'Mahsulot', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (name: string, product) => <span className={styles.productInfo}><Typography.Text strong>{name}</Typography.Text><small>ID: {product.id}</small></span> },
    { title: 'Slug', dataIndex: 'slug', width: 180, render: (slug: string) => <code className={styles.sku}>{slug || '—'}</code> },
    { title: 'Kategoriya', dataIndex: 'category', render: (category: string) => category || <span className={styles.muted}>Kategoriyasiz</span> },
    { title: 'Narxi', dataIndex: 'price', width: 150, render: (price: number) => <MoneyText value={price} />, sorter: (a, b) => a.price - b.price },
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
        placeholder="Mahsulot nomi yoki slug bo‘yicha qidirish..."
        onChange={(value) => { setQuery(value); setPage(1); }}
        actions={
          <>
          <Select<ProductStatusFilter>
            className={styles.statusFilter}
            value={status}
            options={STATUS_FILTERS.map((option) => ({ value: option.value, label: option.label }))}
            suffixIcon={<SlidersHorizontal size={16} />}
            title="Holat bo‘yicha filtrlash"
            onChange={(value) => { setStatus(value); setPage(1); }}
          />
          <ToolbarButton icon={<Download />} onClick={() => void message.info('Eksport tayyorlanmoqda')}>Eksport</ToolbarButton>
          <ToolbarButton icon={<Upload />} onClick={() => void message.info('Import oynasi tayyorlanmoqda')}>Import</ToolbarButton>
          <ToolbarButton type="primary" icon={<PlusOutlined />} onClick={() => void navigate('/products/new')}>
            Mahsulot qo‘shish
          </ToolbarButton>
          </>
        }
      />

      <section className={styles.stats} aria-label="Mahsulot statistikasi">
        <SummaryCard title="Jami mahsulotlar" value={productsQuery.data?.total ?? 0} caption="Katalogdagi barcha mahsulotlar" icon={<PictureOutlined />} />
        <SummaryCard title="Faol mahsulotlar" value={activeCount} caption="Sotuv uchun faol holatda" icon={<PictureOutlined />} tone="success" />
        <SummaryCard title="Sotuvda yo‘q" value={lowStockCount} caption="Qoldiqni yangilash talab qilinadi" icon={<PictureOutlined />} tone="warning" />
      </section>

      <Card className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div>
            <strong>Mahsulotlar ro‘yxati</strong>
            <span>{productsQuery.data?.total ?? 0} ta natija{deferredQuery ? ` · “${deferredQuery}” bo‘yicha` : ''}</span>
          </div>
          {status !== 'ALL' || query ? <Button type="text" onClick={() => { setStatus('ALL'); setQuery(''); setPage(1); }}>Filterlarni tozalash</Button> : null}
        </div>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={products}
          scroll={{ x: 900 }}
          pagination={{ ...createTablePagination(8), current: page, total: productsQuery.data?.total ?? 0 }}
          onChange={(pagination) => setPage(pagination.current ?? 1)}
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
