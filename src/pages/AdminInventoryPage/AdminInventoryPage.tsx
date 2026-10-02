import { Alert, Button, Checkbox, Input, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStockMovementsQuery, useAdminStockQuery } from '../../features/adminInventory/api/adminInventoryQueries';
import { stockMovementTypes, type AdminCatalogWarning, type AdminStockItem, type AdminStockMovement, type AdminVariantInfo, type StockMovementType } from '../../features/adminInventory/model/adminInventoryTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime, toApiDateRange } from '../../shared/lib/date';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { createTablePagination } from '../../shared/ui/DataTable/tablePagination';
import { DateRangeFilter } from '../../shared/ui/DateRangeFilter/DateRangeFilter';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { FilterField } from '../../shared/ui/FilterPanel/FilterField';
import { FilterPanel } from '../../shared/ui/FilterPanel/FilterPanel';
import { FilterSelect } from '../../shared/ui/FilterPanel/FilterSelect';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { SearchInput } from '../../shared/ui/SearchInput/SearchInput';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './AdminInventoryPage.module.css';

const PAGE_SIZE = 20;
type InventoryTab = 'stock' | 'movements';
type WarehouseState = 'all' | 'active' | 'inactive';

const warehouseActiveParam = (state: WarehouseState) =>
  state === 'all' ? {} : { warehouseActive: state === 'active' };
const digitsOnly = (value: string) => value.replace(/\D/g, '');

function useWarehouseStateOptions() {
  const { t } = useTranslation();
  return [
    { value: 'all' as const, label: t('adminOps.allWarehouses') },
    { value: 'active' as const, label: t('adminOps.activeWarehouses') },
    { value: 'inactive' as const, label: t('adminOps.inactiveWarehouses') },
  ];
}

function ProductCell({ item }: { item: AdminVariantInfo }) {
  const { t } = useTranslation();
  if (item.catalogMissing) {
    return <span className={styles.product}><Tag color="orange" bordered={false}>{t('adminOps.catalogMissing')}</Tag><small>#{item.variantId}</small></span>;
  }
  if (!item.productName) {
    return <span className={styles.product}><span className={styles.muted}>{t('adminOps.nameUnavailable')}</span><small>#{item.variantId}</small></span>;
  }
  return (
    <span className={styles.product}>
      <Typography.Text strong>{item.productName}</Typography.Text>
      <small>{[item.variantName, item.sku].filter(Boolean).join(' · ')}</small>
    </span>
  );
}

function WarehouseCell({ name, active }: { name: string; active: boolean }) {
  const { t } = useTranslation();
  return <span className={styles.warehouse}>{name || '—'}{active ? null : <Tag bordered={false}>{t('adminOps.warehouseInactive')}</Tag>}</span>;
}

function CatalogWarnings({ warnings, truncated }: { warnings: AdminCatalogWarning[]; truncated?: boolean }) {
  const { t } = useTranslation();
  if (!warnings.length && !truncated) return null;
  return (
    <div className={styles.alerts}>
      {warnings.length ? <Alert type="warning" showIcon title={t('adminOps.catalogWarning', { shops: warnings.map(({ shopId }) => `#${shopId}`).join(', ') })} /> : null}
      {truncated ? <Alert type="info" showIcon title={t('adminOps.inventory.searchTruncated')} /> : null}
    </div>
  );
}

function StockTab() {
  const { t } = useTranslation();
  const warehouseOptions = useWarehouseStateOptions();
  const [search, setSearch] = useState('');
  const [shopId, setShopId] = useState('');
  const [warehouseState, setWarehouseState] = useState<WarehouseState>('all');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const debouncedShopId = useDebouncedValue(shopId);
  const query = useAdminStockQuery({
    page,
    limit: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(debouncedShopId ? { shopId: debouncedShopId } : {}),
    ...warehouseActiveParam(warehouseState),
    ...(lowOnly ? { lowOnly: true } : {}),
  });
  const hasFilters = Boolean(search || shopId || lowOnly || warehouseState !== 'all');
  const clear = () => { setSearch(''); setShopId(''); setWarehouseState('all'); setLowOnly(false); setPage(1); };

  const columns: ColumnsType<AdminStockItem> = [
    { title: t('adminOps.shop'), dataIndex: 'shopId', width: 90, render: (value: string) => `#${value}` },
    { title: t('adminOps.inventory.product'), render: (_, item) => <ProductCell item={item} /> },
    { title: t('adminOps.inventory.warehouse'), responsive: ['md'], render: (_, item) => <WarehouseCell name={item.warehouseName} active={item.warehouseActive} /> },
    { title: t('adminOps.inventory.onHand'), dataIndex: 'onHand', align: 'right', responsive: ['sm'], render: (value: number) => <span className={styles.number}>{value}</span> },
    { title: t('adminOps.inventory.reserved'), dataIndex: 'reserved', align: 'right', responsive: ['lg'], render: (value: number) => <span className={styles.number}>{value}</span> },
    { title: t('adminOps.inventory.available'), dataIndex: 'available', align: 'right', render: (value: number, item) => <span className={styles.available}>{value}{value <= item.lowStockThreshold ? <Tag color="warning" bordered={false}>{t('adminOps.inventory.low')}</Tag> : null}</span> },
    { title: t('adminOps.inventory.threshold'), dataIndex: 'lowStockThreshold', align: 'right', responsive: ['lg'], render: (value: number) => <span className={styles.number}>{value}</span> },
  ];

  return (
    <div className={styles.page}>
      <FilterPanel className={styles.filters} aria-label={t('admin.common.filters')}>
        <FilterField label={t('adminOps.inventory.search')} htmlFor="admin-stock-search">
          <SearchInput id="admin-stock-search" value={search} placeholder={t('adminOps.inventory.search')} onValueChange={(value) => { setSearch(value); setPage(1); }} />
        </FilterField>
        <FilterField label={t('adminOps.shopId')} htmlFor="admin-stock-shop">
          <Input id="admin-stock-shop" value={shopId} inputMode="numeric" allowClear placeholder="15" onChange={(event) => { setShopId(digitsOnly(event.target.value)); setPage(1); }} />
        </FilterField>
        <FilterField label={t('adminOps.warehouseState')} htmlFor="admin-stock-warehouse">
          <FilterSelect<WarehouseState> id="admin-stock-warehouse" value={warehouseState} options={warehouseOptions} onChange={(value) => { setWarehouseState(value); setPage(1); }} />
        </FilterField>
        <Checkbox className={styles.checkbox} checked={lowOnly} onChange={(event) => { setLowOnly(event.target.checked); setPage(1); }}>{t('adminOps.inventory.lowOnly')}</Checkbox>
        <div className={styles.clear}><Button icon={<RotateCcw size={16} />} disabled={!hasFilters} onClick={clear}>{t('adminOps.clear')}</Button></div>
      </FilterPanel>
      {query.isPending ? <ContentState state="loading" /> : query.isError ? (
        <ContentState state="error" title={t('adminOps.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />
      ) : (
        <>
          <CatalogWarnings warnings={query.data.warnings} truncated={query.data.searchTruncated} />
          <TablePanel title={t('adminOps.inventory.stockTab')} caption={t('pagination.total', { total: query.data.total })}>
            <DataTable
              rowKey={(item) => `${item.warehouseId}:${item.variantId}`}
              loading={query.isFetching}
              columns={columns}
              dataSource={query.data.items}
              tableLayout="auto"
              scroll={{ x: 'max-content' }}
              emptyState={<EmptyState compact title={t('adminOps.inventory.emptyStock')} description={t('adminOps.inventory.emptyDescription')} />}
              pagination={{ ...createTablePagination(PAGE_SIZE, (total) => t('pagination.total', { total })), current: page, total: query.data.total }}
              onChange={(pagination) => setPage(pagination.current ?? 1)}
            />
          </TablePanel>
        </>
      )}
    </div>
  );
}

function MovementsTab() {
  const { locale, t } = useTranslation();
  const warehouseOptions = useWarehouseStateOptions();
  const [shopId, setShopId] = useState('');
  const [type, setType] = useState<StockMovementType | 'ALL'>('ALL');
  const [warehouseState, setWarehouseState] = useState<WarehouseState>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const debouncedShopId = useDebouncedValue(shopId);
  const query = useAdminStockMovementsQuery({
    page,
    limit: PAGE_SIZE,
    ...(debouncedShopId ? { shopId: debouncedShopId } : {}),
    ...(type !== 'ALL' ? { type } : {}),
    ...warehouseActiveParam(warehouseState),
    ...toApiDateRange(dateFrom, dateTo),
  });
  const typeLabel = (value: string) => stockMovementTypes.includes(value as StockMovementType) ? t(`adminOps.movement.${value}` as TranslationKey) : value;
  const hasFilters = Boolean(shopId || dateFrom || dateTo || type !== 'ALL' || warehouseState !== 'all');
  const clear = () => { setShopId(''); setType('ALL'); setWarehouseState('all'); setDateFrom(''); setDateTo(''); setPage(1); };

  const columns: ColumnsType<AdminStockMovement> = [
    { title: t('adminOps.inventory.date'), dataIndex: 'createdAt', width: 170, render: (value: string) => value ? formatDateTime(value, locale) : '—' },
    { title: t('adminOps.shop'), dataIndex: 'shopId', width: 90, responsive: ['md'], render: (value: string) => `#${value}` },
    { title: t('adminOps.inventory.product'), render: (_, item) => <ProductCell item={item} /> },
    { title: t('adminOps.inventory.warehouse'), responsive: ['lg'], render: (_, item) => <WarehouseCell name={item.warehouseName} active={item.warehouseActive} /> },
    { title: t('adminOps.inventory.type'), dataIndex: 'type', render: (value: string) => <Tag bordered={false}>{typeLabel(value)}</Tag> },
    { title: t('adminOps.inventory.quantity'), dataIndex: 'quantity', align: 'right', render: (value: number) => <span className={`${styles.number} ${value < 0 ? styles.negative : styles.positive}`}>{value > 0 ? `+${value}` : value}</span> },
    { title: t('adminOps.inventory.after'), align: 'right', responsive: ['sm'], render: (_, item) => <span className={styles.number}>{item.onHandAfter} / {item.reservedAfter}</span> },
    { title: t('adminOps.inventory.reference'), responsive: ['xl'], render: (_, item) => [item.referenceType, item.referenceId ? `#${item.referenceId}` : null].filter(Boolean).join(' ') || '—' },
    { title: t('adminOps.inventory.reason'), dataIndex: 'reason', responsive: ['xl'], render: (value: string | null) => value || '—' },
  ];

  return (
    <div className={styles.page}>
      <FilterPanel className={styles.movementFilters} aria-label={t('admin.common.filters')}>
        <FilterField label={t('adminOps.shopId')} htmlFor="admin-movement-shop">
          <Input id="admin-movement-shop" value={shopId} inputMode="numeric" allowClear placeholder="15" onChange={(event) => { setShopId(digitsOnly(event.target.value)); setPage(1); }} />
        </FilterField>
        <FilterField label={t('adminOps.inventory.type')} htmlFor="admin-movement-type">
          <FilterSelect<StockMovementType | 'ALL'> id="admin-movement-type" value={type} options={[{ value: 'ALL' as const, label: t('adminOps.inventory.allTypes') }, ...stockMovementTypes.map((value) => ({ value, label: typeLabel(value) }))]} onChange={(value) => { setType(value); setPage(1); }} />
        </FilterField>
        <FilterField label={t('adminOps.warehouseState')} htmlFor="admin-movement-warehouse">
          <FilterSelect<WarehouseState> id="admin-movement-warehouse" value={warehouseState} options={warehouseOptions} onChange={(value) => { setWarehouseState(value); setPage(1); }} />
        </FilterField>
        <DateRangeFilter className={styles.dateRange} value={[dateFrom, dateTo]} startLabel={t('adminOps.delivery.dateFrom')} endLabel={t('adminOps.delivery.dateTo')} onChange={([from, to]) => { setDateFrom(from); setDateTo(to); setPage(1); }} />
        <div className={styles.clear}><Button icon={<RotateCcw size={16} />} disabled={!hasFilters} onClick={clear}>{t('adminOps.clear')}</Button></div>
      </FilterPanel>
      {query.isPending ? <ContentState state="loading" /> : query.isError ? (
        <ContentState state="error" title={t('adminOps.loadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />
      ) : (
        <>
          <CatalogWarnings warnings={query.data.warnings} />
          <TablePanel title={t('adminOps.inventory.movementsTab')} caption={t('pagination.total', { total: query.data.total })}>
            <DataTable
              rowKey="id"
              loading={query.isFetching}
              columns={columns}
              dataSource={query.data.items}
              tableLayout="auto"
              scroll={{ x: 'max-content' }}
              emptyState={<EmptyState compact title={t('adminOps.inventory.emptyMovements')} description={t('adminOps.inventory.emptyDescription')} />}
              pagination={{ ...createTablePagination(PAGE_SIZE, (total) => t('pagination.total', { total })), current: page, total: query.data.total }}
              onChange={(pagination) => setPage(pagination.current ?? 1)}
            />
          </TablePanel>
        </>
      )}
    </div>
  );
}

/** C6.7 — admin butun platforma qoldig‘i va harakatlarini bir joydan ko‘radi. */
export default function AdminInventoryPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: InventoryTab = searchParams.get('tab') === 'movements' ? 'movements' : 'stock';
  return (
    <main className={styles.page}>
      <PageHeader title={t('adminOps.inventory.title')} description={t('adminOps.inventory.description')} />
      <Tabs
        activeKey={tab}
        destroyOnHidden
        onChange={(key) => setSearchParams(key === 'stock' ? {} : { tab: key }, { replace: true })}
        items={[
          { key: 'stock', label: t('adminOps.inventory.stockTab'), children: <StockTab /> },
          { key: 'movements', label: t('adminOps.inventory.movementsTab'), children: <MovementsTab /> },
        ]}
      />
    </main>
  );
}
