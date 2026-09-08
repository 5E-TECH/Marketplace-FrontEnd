import { App, Button, Input, Select, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRight, Image as ImageIcon, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAdminProductsQuery,
  useReactivateAdminProductMutation,
  useSuspendAdminProductMutation,
} from '../../features/adminProducts/api/adminProductQueries';
import type { AdminProduct } from '../../features/adminProducts/model/adminProductTypes';
import { getAdminProductModerationConfig } from '../../features/adminProducts/ui/adminProductModerationConfig';
import type { ProductStatus } from '../../features/products/model/productTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { IconActionButton } from '../../shared/ui/IconActionButton/IconActionButton';
import { MoneyText } from '../../shared/ui/MoneyText/MoneyText';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import styles from './AdminProductsPage.module.css';

type StatusFilter = 'ALL' | Extract<ProductStatus, 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'OUT_OF_STOCK'>;
type ModerationFilter = 'ALL' | 'ACTIVE' | 'BLOCKED';

export default function AdminProductsPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [shopId, setShopId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [moderation, setModeration] = useState<ModerationFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<AdminProduct | null>(null);
  const deferredSearch = useDebouncedValue(search.trim());
  const deferredShopId = useDebouncedValue(shopId.trim());
  const query = useAdminProductsQuery({
    page,
    limit: 20,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(deferredShopId ? { shopId: deferredShopId } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(moderation !== 'ALL' ? { blocked: moderation === 'BLOCKED' } : {}),
  });
  const suspendMutation = useSuspendAdminProductMutation();
  const reactivateMutation = useReactivateAdminProductMutation();

  const columns = useMemo<ColumnsType<AdminProduct>>(() => [
    {
      title: '',
      width: 72,
      render: (_, product) => product.imageUrl ? (
        <img className={styles.thumbnail} src={product.imageUrl} alt="" loading="lazy" />
      ) : (
        <span className={styles.thumbnailFallback}><ImageIcon aria-hidden /></span>
      ),
    },
    {
      title: t('adminProducts.product'),
      dataIndex: 'name',
      render: (name: string, product) => (
        <button
          className={styles.productLink}
          type="button"
          onClick={() => void navigate(`/admin/products/${product.id}`)}
        >
          <strong>{name}</strong>
          <small>#{product.id} · {product.slug || t('common.none')}</small>
        </button>
      ),
    },
    {
      title: t('adminProducts.shop'),
      dataIndex: 'shopId',
      width: 110,
      responsive: ['md'],
      render: (value: string) => value ? `#${value}` : '—',
    },
    {
      title: t('adminProducts.category'),
      dataIndex: 'categoryId',
      width: 120,
      responsive: ['lg'],
      render: (value: string) => value ? `#${value}` : '—',
    },
    {
      title: t('adminProducts.price'),
      dataIndex: 'price',
      width: 140,
      render: (value: number) => <MoneyText value={value} />,
    },
    {
      title: t('adminProducts.rating'),
      dataIndex: 'rating',
      width: 92,
      responsive: ['xl'],
      render: (value: number) => value > 0 ? value.toFixed(1) : '—',
    },
    {
      title: t('common.status'),
      width: 125,
      render: (_, product) => <StatusTag status={product.isBlocked ? 'BLOCKED' : product.status} />,
    },
    {
      title: t('common.actions'),
      width: 205,
      align: 'center',
      render: (_, product) => {
        const config = getAdminProductModerationConfig(product.isBlocked);
        return (
          <div className={styles.actions}>
            <Button
              className={styles.detailButton}
              type="link"
              onClick={() => void navigate(`/admin/products/${product.id}`)}
            >
              {t('common.details')} <ArrowRight size={15} aria-hidden />
            </Button>
            <IconActionButton
              danger={config.danger}
              icon={<config.Icon size={17} />}
              label={t(config.labelKey)}
              onClick={() => setPendingAction(product)}
            />
          </div>
        );
      },
    },
  ], [navigate, t]);

  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return (
    <ContentState
      state="error"
      title={t('adminProducts.loadError')}
      description={getAuthErrorMessage(query.error)}
      onAction={() => void query.refetch()}
    />
  );

  const hasFilters = Boolean(search || shopId) || status !== 'ALL' || moderation !== 'ALL';
  const actionConfig = pendingAction ? getAdminProductModerationConfig(pendingAction.isBlocked) : null;
  const actionMutation = actionConfig?.action === 'reactivate' ? reactivateMutation : suspendMutation;

  return (
    <main className={styles.page}>
      <PageHeader
        title={t('adminProducts.title')}
        description={t('adminProducts.description')}
      />

      <FilterPanel className={styles.filters} aria-label={t('admin.common.filters')}>
        <Input
          prefix={<Search aria-hidden />}
          allowClear
          value={search}
          placeholder={t('adminProducts.search')}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
        />
        <Input
          allowClear
          value={shopId}
          inputMode="numeric"
          placeholder={t('adminProducts.shopPlaceholder')}
          onChange={(event) => { setShopId(event.target.value); setPage(1); }}
        />
        <Select<StatusFilter>
          value={status}
          aria-label={t('adminProducts.productStatus')}
          options={[
            { value: 'ALL', label: t('adminProducts.allProductStatuses') },
            { value: 'DRAFT', label: t('status.draft') },
            { value: 'ACTIVE', label: t('status.active') },
            { value: 'OUT_OF_STOCK', label: t('status.outOfStock') },
            { value: 'ARCHIVED', label: t('status.archived') },
          ]}
          onChange={(value) => { setStatus(value); setPage(1); }}
        />
        <Select<ModerationFilter>
          value={moderation}
          aria-label={t('adminProducts.moderationStatus')}
          options={[
            { value: 'ALL', label: t('adminProducts.allModerationStatuses') },
            { value: 'ACTIVE', label: t('adminProducts.available') },
            { value: 'BLOCKED', label: t('status.blocked') },
          ]}
          onChange={(value) => { setModeration(value); setPage(1); }}
        />
        <Button
          icon={<RotateCcw size={16} />}
          disabled={!hasFilters}
          onClick={() => {
            setSearch('');
            setShopId('');
            setStatus('ALL');
            setModeration('ALL');
            setPage(1);
          }}
        >
          {t('adminOrders.clear')}
        </Button>
      </FilterPanel>

      <section className={styles.tablePanel} aria-label={t('adminProducts.list')}>
        <header className={styles.tableHeader}>
          <div>
            <Typography.Title level={2}>{t('adminProducts.list')}</Typography.Title>
            <Typography.Text>{t('adminProducts.resultCount', { count: query.data.total })}</Typography.Text>
          </div>
        </header>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={query.data.items}
          scroll={{ x: 980 }}
          emptyState={<EmptyState compact title={t('adminProducts.empty')} description={t('adminProducts.emptyDescription')} />}
          pagination={{ ...createTablePagination(20, (total) => t('pagination.total', { total })), current: page, total: query.data.total }}
          onChange={(pagination) => setPage(pagination.current ?? 1)}
        />
      </section>

      <ConfirmDialog
        open={Boolean(pendingAction && actionConfig)}
        title={actionConfig ? t(actionConfig.titleKey) : ''}
        description={actionConfig && pendingAction
          ? t(actionConfig.descriptionKey, { name: pendingAction.name })
          : ''}
        confirmText={actionConfig ? t(actionConfig.labelKey) : undefined}
        danger={actionConfig?.danger}
        loading={actionMutation.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction || !actionConfig) return;
          actionMutation.mutate(pendingAction.id, {
            onSuccess: () => {
              void message.success(t(actionConfig.successKey));
              setPendingAction(null);
            },
            onError: (error) => void message.error(getAuthErrorMessage(error)),
          });
        }}
      />
    </main>
  );
}
