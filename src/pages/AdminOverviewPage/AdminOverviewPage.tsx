import { ArrowUpRight, Banknote, ShoppingCart, Store, Users } from 'lucide-react';
import { Card, Col, Progress, Row, Statistic, Table, Tag } from 'antd';
import type { ReactNode } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './AdminOverviewPage.module.css';
import { useAdminDashboardQuery } from '../../features/dashboard/api/dashboardQueries';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { useTranslation } from '../../shared/i18n/useTranslation';

const activity = [{ key: '1', region: 'Toshkent', orders: 1240, share: 64 }, { key: '2', region: 'Samarqand', orders: 420, share: 22 }, { key: '3', region: 'Farg‘ona', orders: 275, share: 14 }];
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
    <Row gutter={[16, 16]} className={styles.content}><Col xs={24} xl={16}><Card title={t('admin.overview.salesTrend')} extra={t('admin.overview.lastSevenDays')}><div className={styles.chart} aria-label={t('admin.overview.salesTrend')}>{[38,55,44,72,66,88,76].map((height, index) => <div key={index}><span style={{ height: `${height}%` }} /><small>{['Du','Se','Ch','Pa','Ju','Sh','Ya'][index]}</small></div>)}</div></Card></Col><Col xs={24} xl={8}><Card title={t('admin.overview.regionalActivity')}><Table pagination={false} size="small" dataSource={activity} columns={[{ title: t('admin.overview.region'), dataIndex: 'region' }, { title: t('admin.overview.order'), dataIndex: 'orders' }, { title: t('admin.overview.share'), render: (_, row) => <Progress percent={row.share} size="small" /> }]} /></Card></Col></Row>
  </main>;
}
