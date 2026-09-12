import { Button, Skeleton, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Banknote, ClipboardList, ExternalLink, Eye, Store, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminShopsQuery } from '../../features/adminShops/api/adminShopQueries';
import type { AdminShop } from '../../features/adminShops/model/adminShopTypes';
import { useAdminDashboardQuery } from '../../features/dashboard/api/dashboardQueries';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DataTable } from '../../shared/ui/DataTable/DataTable';
import { EmptyState } from '../../shared/ui/EmptyState/EmptyState';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { SummaryCard } from '../../shared/ui/SummaryCard/SummaryCard';
import { TablePanel } from '../../shared/ui/TablePanel/TablePanel';
import styles from './AdminOverviewPage.module.css';

interface Metric {
  title: string;
  value: string | number;
  caption: string;
  icon: ReactNode;
  tone?: 'info' | 'success' | 'warning';
}

function DashboardSkeleton() {
  return (
    <main aria-label="Dashboard yuklanmoqda">
      <Skeleton active title={{ width: 220 }} paragraph={{ rows: 1, width: 360 }} />
      <div className={styles.metricGrid}>
        {Array.from({ length: 5 }, (_, index) => (
          <div className={styles.metricSkeleton} key={index}><Skeleton active paragraph={{ rows: 2 }} /></div>
        ))}
      </div>
      <div className={styles.tableSkeleton}><Skeleton active paragraph={{ rows: 5 }} /></div>
    </main>
  );
}

export default function AdminOverviewPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dashboardQuery = useAdminDashboardQuery();
  const pendingShopsQuery = useAdminShopsQuery({ page: 1, limit: 5, status: 'PENDING' });

  if (dashboardQuery.isPending || pendingShopsQuery.isPending) return <DashboardSkeleton />;
  if (dashboardQuery.isError || pendingShopsQuery.isError) {
    return <ContentState state="error" title={t('admin.overview.loadError')} onAction={() => {
      void dashboardQuery.refetch();
      void pendingShopsQuery.refetch();
    }} />;
  }

  const dashboard = dashboardQuery.data;
  const metrics: Metric[] = [
    { title: t('admin.overview.shops'), value: dashboard.shops.total, caption: t('admin.overview.pending', { count: dashboard.shops.pending }), icon: <Store />, tone: 'info' },
    { title: t('admin.overview.sellers'), value: dashboard.users.sellers, caption: t('admin.overview.activeShops', { count: dashboard.shops.active }), icon: <UserRound />, tone: 'success' },
    { title: t('admin.overview.orders'), value: dashboard.orders.total, caption: t('admin.overview.today', { count: dashboard.orders.today }), icon: <ClipboardList />, tone: 'info' },
    { title: t('admin.overview.gmv'), value: `${formatMoney(dashboard.gmv)} UZS`, caption: t('admin.overview.totalVolume'), icon: <Banknote />, tone: 'warning' },
    { title: t('admin.overview.revenue'), value: `${formatMoney(dashboard.revenue)} UZS`, caption: t('admin.overview.platformRevenue'), icon: <Banknote />, tone: 'success' },
  ];
  const columns: ColumnsType<AdminShop> = [
    { title: t('adminShops.market'), dataIndex: 'name', render: (name: string) => <strong>{name}</strong> },
    { title: t('adminShops.ownerId'), dataIndex: 'ownerUserId', width: 130, responsive: ['sm'], render: (id: string) => `#${id}` },
    { title: t('users.phone'), dataIndex: 'phone', responsive: ['md'] },
    { title: t('users.status'), dataIndex: 'status', width: 120, render: () => <Tag color="warning">PENDING</Tag> },
    { title: t('users.actions'), width: 100, align: 'center', render: (_, shop) => <Button type="text" icon={<Eye size={16} />} onClick={() => void navigate(`/admin/shops?shopId=${encodeURIComponent(shop.id)}`)}>Ko‘rish</Button> },
  ];

  return (
    <main className={styles.page}>
      <PageHeader title={t('admin.overview.title')} description={t('admin.overview.description')} />
      <section className={styles.metricGrid} aria-label={t('admin.overview.statistics')}>
        {metrics.map((metric) => <SummaryCard key={metric.title} {...metric} />)}
      </section>
      <TablePanel className={styles.pendingPanel} title={t('admin.overview.pendingShops')} caption={t('admin.overview.pendingShopsDescription')} action={
        <Button type="link" icon={<ExternalLink size={16} />} onClick={() => void navigate('/admin/shops')}>{t('admin.overview.viewAll')}</Button>
      }>
        <DataTable rowKey="id" columns={columns} dataSource={pendingShopsQuery.data.items} pagination={false} scroll={{ x: 'max-content' }} emptyState={
          <EmptyState compact title={t('admin.overview.noPendingShops')} description={t('admin.overview.noPendingShopsDescription')} />
        } />
      </TablePanel>
    </main>
  );
}
