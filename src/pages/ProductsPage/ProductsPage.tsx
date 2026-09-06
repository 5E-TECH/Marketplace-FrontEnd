import {
  Download,
  Image as PictureOutlined,
  Pencil as EditOutlined,
  Plus as PlusOutlined,
  SlidersHorizontal,
  Trash2 as DeleteOutlined,
  Upload,
} from 'lucide-react';
import { App, Button, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { SummaryCard } from '../../shared/ui/SummaryCard/SummaryCard';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const routeSearch = searchParams.get('search')?.trim() ?? '';
  const [status, setStatus] = useState<ProductStatusFilter>('ALL');
  const [localQuery, setLocalQuery] = useState('');
  const query = routeSearch || localQuery;
  const [page, setPage] = useState(1);
  const deferredQuery = useDebouncedValue(query.trim());
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
      width: 64,
      render: (_, product) => product.imageUrl
        ? <img className={styles.productImage} src={product.imageUrl} alt="" loading="lazy" />
        : <span className={styles.imagePlaceholder}><PictureOutlined /></span>,
    },
    { title: 'Mahsulot', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (name: string, product) => <span className={styles.productInfo}><Typography.Text strong>{name}</Typography.Text><small>ID: {product.id}</small></span> },
    { title: 'Slug', dataIndex: 'slug', width: 170, responsive: ['xl'], render: (slug: string) => <code className={styles.sku}>{slug || '—'}</code> },
    { title: 'Kategoriya', dataIndex: 'category', width: 150, responsive: ['lg'], ellipsis: true, render: (category: string) => category || <span className={styles.muted}>Kategoriyasiz</span> },
    { title: 'Narxi', dataIndex: 'price', width: 130, render: (price: number) => <MoneyText value={price} />, sorter: (a, b) => a.price - b.price },
    { title: 'Qoldiq', dataIndex: 'stock', width: 90, responsive: ['md'], sorter: (a, b) => a.stock - b.stock },
    { title: 'Holati', dataIndex: 'status', width: 120, responsive: ['sm'], render: (status: Product['status']) => <StatusTag status={status} /> },
    {
      title: 'Amallar',
      width: 116,
      align: 'center',
      render: (_, product) => (
        <span className={styles.rowActions}>
          <Button className={styles.editAction} type="text" shape="circle" icon={<EditOutlined />} aria-label={`${product.name} mahsulotini tahrirlash`} onClick={() => void navigate(`/products/${product.id}/edit`)} />
          <Button className={styles.deleteAction} type="text" shape="circle" danger icon={<DeleteOutlined />} aria-label={`${product.name} mahsulotini o‘chirish`} onClick={() => setDeletingProduct(product)} />
        </span>
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        title="Mahsulotlar"
        description="Katalog, narxlar va mahsulot qoldiqlarini boshqaring"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void navigate('/products/new')}>
            Mahsulot qo‘shish
          </Button>
        }
      />
      <ListToolbar
        value={query}
        placeholder="Mahsulot nomi yoki slug bo‘yicha qidirish..."
        onChange={(value) => {
          if (routeSearch) setSearchParams({}, { replace: true });
          setLocalQuery(value);
          setPage(1);
        }}
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
          </>
        }
      />

      <section className={styles.stats} aria-label="Mahsulot statistikasi">
        <SummaryCard title="Jami mahsulotlar" value={productsQuery.data?.total ?? 0} caption="Katalogdagi barcha mahsulotlar" icon={<PictureOutlined />} />
        <SummaryCard title="Faol mahsulotlar" value={activeCount} caption="Sotuv uchun faol holatda" icon={<PictureOutlined />} tone="success" />
        <SummaryCard title="Sotuvda yo‘q" value={lowStockCount} caption="Qoldiqni yangilash talab qilinadi" icon={<PictureOutlined />} tone="warning" />
      </section>

      <TablePanel
        className={styles.tableCard}
        title="Mahsulotlar ro‘yxati"
        caption={`${productsQuery.data?.total ?? 0} ta natija${deferredQuery ? ` · “${deferredQuery}” bo‘yicha` : ''}`}
        action={status !== 'ALL' || query ? <Button type="text" onClick={() => { setStatus('ALL'); setLocalQuery(''); setSearchParams({}, { replace: true }); setPage(1); }}>Filterlarni tozalash</Button> : null}
      >
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={products}
          tableLayout="auto"
          pagination={{ ...createTablePagination(8), current: page, total: productsQuery.data?.total ?? 0 }}
          onChange={(pagination) => setPage(pagination.current ?? 1)}
        />
      </TablePanel>
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
