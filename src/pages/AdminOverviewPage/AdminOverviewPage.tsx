import { ArrowUpRight, Banknote, ShoppingCart, Store, Users } from 'lucide-react';
import { Card, Col, Row, Statistic, Tag } from 'antd';
import type { ReactNode } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './AdminOverviewPage.module.css';
import { useAdminDashboardQuery } from '../../features/dashboard/api/dashboardQueries';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { useTranslation } from '../../shared/i18n/useTranslation';

export default function AdminOverviewPage() {
  const { t } = useTranslation();
  const query = useAdminDashboardQuery();
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title={t('admin.overview.loadError')} onAction={() => void query.refetch()} />;
  const dashboard = query.data;
  const metrics: Array<{ title: string; value: string; icon: ReactNode; trend: string }> = [
    { title: t('admin.overview.revenue'), value: `${formatMoney(dashboard.revenue)} UZS`, icon: <Banknote />, trend: `${t('admin.overview.gmv')} ${formatMoney(dashboard.gmv)}` }, { title: t('admin.overview.orders'), value: String(dashboard.orders.total), icon: <ShoppingCart />, trend: t('admin.overview.today', { count: dashboard.orders.today }) }, { title: t('admin.overview.sellers'), value: String(dashboard.shops.active), icon: <Store />, trend: t('admin.overview.pending', { count: dashboard.shops.pending }) }, { title: t('admin.overview.users'), value: String(dashboard.users.total), icon: <Users />, trend: t('admin.overview.buyers', { count: dashboard.users.buyers }) },
  ];
  return <main><PageHeader title={t('admin.overview.title')} description={t('admin.overview.description')} />
    <Row gutter={[16, 16]}>{metrics.map(({ title, value, icon, trend }) => <Col xs={24} sm={12} xl={6} key={title}><Card className={styles.metric}><div className={styles.metricTop}><span>{icon}</span><Tag color="success"><ArrowUpRight size={12} />{trend}</Tag></div><Statistic title={title} value={value} /></Card></Col>)}</Row>
  </main>;
}
