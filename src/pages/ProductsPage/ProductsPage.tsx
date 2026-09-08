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
import { useTranslation } from '../../shared/i18n/useTranslation';
import { usePublicCategoriesQuery } from '../../features/categories/api/categoryQueries';
import { createCategoryOptions } from '../../features/categories/lib/categoryOptions';

type ProductStatusFilter = 'ALL' | Product['status'];
const EMPTY_PRODUCTS: Product[] = [];

export default function ProductsPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const statusFilters: Array<{ value: ProductStatusFilter; label: string }> = [
    { value: 'ALL', label: t('product.allStatuses') },
    { value: 'DRAFT', label: t('status.draft') },
    { value: 'ACTIVE', label: t('status.active') },
    { value: 'OUT_OF_STOCK', label: t('status.outOfStock') },
    { value: 'ARCHIVED', label: t('status.archived') },
  ];
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeSearch = searchParams.get('search')?.trim() ?? '';
  const [status, setStatus] = useState<ProductStatusFilter>('ALL');
  const [categoryId, setCategoryId] = useState('ALL');
  const [localQuery, setLocalQuery] = useState('');
  const query = routeSearch || localQuery;
  const [page, setPage] = useState(1);
  const deferredQuery = useDebouncedValue(query.trim());
  const productsQuery = useMyProductsQuery({
    page,
    limit: 8,
    ...(deferredQuery ? { search: deferredQuery } : {}),
    ...(status !== 'ALL' && ['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'].includes(status) ? { status: status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'OUT_OF_STOCK' } : {}),
    ...(categoryId !== 'ALL' ? { categoryId } : {}),
  });
  const categoriesQuery = usePublicCategoriesQuery();
  const categoryOptions = useMemo(
    () => [{ value: 'ALL', label: t('product.allCategories') }, ...createCategoryOptions(categoriesQuery.data ?? [])],
    [categoriesQuery.data, t],
  );
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
        void message.success(t('product.deleted'));
      },
      onError: (error) => void message.error(getAuthErrorMessage(error)),
    });
  };

  if (productsQuery.isPending) {
    return (
      <main className={styles.page}>
        <Typography.Title level={1} className={styles.srOnly}>
          {t('product.title')}
        </Typography.Title>
        <ContentState state="loading" />
      </main>
    );
  }
  if (productsQuery.isError) {
    return (
      <main className={styles.page}>
        <Typography.Title level={1} className={styles.srOnly}>
          {t('product.title')}
        </Typography.Title>
        <ContentState
          state="error"
          title={t('product.loadError')}
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
    { title: t('product.product'), dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (name: string, product) => <span className={styles.productInfo}><Typography.Text strong>{name}</Typography.Text><small>ID: {product.id}</small></span> },
    { title: 'Slug', dataIndex: 'slug', width: 170, responsive: ['xl'], render: (slug: string) => <code className={styles.sku}>{slug || '—'}</code> },
    { title: t('product.category'), dataIndex: 'category', width: 150, responsive: ['lg'], ellipsis: true, render: (category: string) => category || <span className={styles.muted}>{t('product.noCategory')}</span> },
    { title: t('product.price'), dataIndex: 'price', width: 130, render: (price: number) => <MoneyText value={price} />, sorter: (a, b) => a.price - b.price },
    { title: t('product.stock'), dataIndex: 'stock', width: 90, responsive: ['md'], sorter: (a, b) => a.stock - b.stock },
    { title: t('product.rating'), dataIndex: 'rating', width: 90, responsive: ['xl'], render: (rating: number) => rating > 0 ? rating.toFixed(1) : '—' },
    { title: t('common.status'), width: 120, responsive: ['sm'], render: (_, product) => <StatusTag status={product.isBlocked ? 'BLOCKED' : product.status} /> },
    {
      title: t('common.actions'),
      width: 116,
      align: 'center',
      render: (_, product) => (
        <span className={styles.rowActions}>
          <Button className={styles.editAction} type="text" shape="circle" icon={<EditOutlined />} aria-label={t('product.editAria', { name: product.name })} onClick={() => void navigate(`/products/${product.id}/edit`)} />
          <Button className={styles.deleteAction} type="text" shape="circle" danger icon={<DeleteOutlined />} aria-label={t('product.deleteAria', { name: product.name })} onClick={() => setDeletingProduct(product)} />
        </span>
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <PageHeader
        title={t('product.title')}
        description={t('product.description')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void navigate('/products/new')}>
            {t('product.add')}
          </Button>
        }
      />
      <ListToolbar
        value={query}
        placeholder={t('product.search')}
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
            options={statusFilters}
            suffixIcon={<SlidersHorizontal size={16} />}
            title={t('product.filterStatus')}
            aria-label={t('product.filterStatus')}
            onChange={(value) => { setStatus(value); setPage(1); }}
          />
          <Select
            className={styles.statusFilter}
            value={categoryId}
            options={categoryOptions}
            loading={categoriesQuery.isPending}
            showSearch
            virtual={false}
            optionFilterProp="label"
            title={t('product.filterCategory')}
            aria-label={t('product.filterCategory')}
            onChange={(value) => { setCategoryId(value); setPage(1); }}
          />
          <ToolbarButton icon={<Download />} onClick={() => void message.info(t('product.exportPreparing'))}>{t('product.export')}</ToolbarButton>
          <ToolbarButton icon={<Upload />} onClick={() => void message.info(t('product.importPreparing'))}>{t('product.import')}</ToolbarButton>
          </>
        }
      />

      <section className={styles.stats} aria-label={t('product.statistics')}>
        <SummaryCard title={t('product.total')} value={productsQuery.data?.total ?? 0} caption={t('product.totalCaption')} icon={<PictureOutlined />} />
        <SummaryCard title={t('product.active')} value={activeCount} caption={t('product.activeCaption')} icon={<PictureOutlined />} tone="success" />
        <SummaryCard title={t('status.outOfStock')} value={lowStockCount} caption={t('product.outOfStockCaption')} icon={<PictureOutlined />} tone="warning" />
      </section>

      <TablePanel
        className={styles.tableCard}
        title={t('product.list')}
        caption={deferredQuery ? t('product.resultSearch', { count: productsQuery.data?.total ?? 0, query: deferredQuery }) : t('product.resultCount', { count: productsQuery.data?.total ?? 0 })}
        action={status !== 'ALL' || categoryId !== 'ALL' || query ? <Button type="text" onClick={() => { setStatus('ALL'); setCategoryId('ALL'); setLocalQuery(''); setSearchParams({}, { replace: true }); setPage(1); }}>{t('product.clearFilters')}</Button> : null}
      >
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={products}
          tableLayout="auto"
          pagination={{ ...createTablePagination(8, (total) => t('pagination.total', { total })), current: page, total: productsQuery.data?.total ?? 0 }}
          onChange={(pagination) => setPage(pagination.current ?? 1)}
        />
      </TablePanel>
      <ConfirmDialog
        open={Boolean(deletingProduct)}
        title={t('product.deleteTitle')}
        description={t('product.deleteDescription', { name: deletingProduct?.name ?? t('product.unknown') })}
        confirmText={t('common.delete')}
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
