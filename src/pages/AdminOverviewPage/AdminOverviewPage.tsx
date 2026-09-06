import { ArrowUpRight, Banknote, ShoppingCart, Store, Users } from 'lucide-react';
import { Card, Col, Progress, Row, Statistic, Table, Tag } from 'antd';
import type { ReactNode } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import styles from './AdminOverviewPage.module.css';
import { useAdminDashboardQuery } from '../../features/dashboard/api/dashboardQueries';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';

const activity = [{ key: '1', region: 'Toshkent', orders: 1240, share: 64 }, { key: '2', region: 'Samarqand', orders: 420, share: 22 }, { key: '3', region: 'Farg‘ona', orders: 275, share: 14 }];
export default function AdminOverviewPage() {
  const query = useAdminDashboardQuery();
  if (query.isPending) return <ContentState state="loading" />;
  if (query.isError) return <ContentState state="error" title="Admin statistikasini yuklab bo‘lmadi" onAction={() => void query.refetch()} />;
  const dashboard = query.data;
  const metrics: Array<{ title: string; value: string; icon: ReactNode; trend: string }> = [
    { title: 'Platforma daromadi', value: `${formatMoney(dashboard.revenue)} UZS`, icon: <Banknote />, trend: `GMV ${formatMoney(dashboard.gmv)}` }, { title: 'Jami buyurtmalar', value: String(dashboard.orders.total), icon: <ShoppingCart />, trend: `Bugun ${dashboard.orders.today}` }, { title: 'Faol sotuvchilar', value: String(dashboard.shops.active), icon: <Store />, trend: `${dashboard.shops.pending} kutilmoqda` }, { title: 'Foydalanuvchilar', value: String(dashboard.users.total), icon: <Users />, trend: `${dashboard.users.buyers} xaridor` },
  ];
  return <main><PageHeader title="Marketplace analytics" description="Platformaning real vaqtga yaqin umumiy ko‘rsatkichlari" />
    <Row gutter={[16, 16]}>{metrics.map(({ title, value, icon, trend }) => <Col xs={24} sm={12} xl={6} key={title}><Card className={styles.metric}><div className={styles.metricTop}><span>{icon}</span><Tag color="success"><ArrowUpRight size={12} />{trend}</Tag></div><Statistic title={title} value={value} /></Card></Col>)}</Row>
    <Row gutter={[16, 16]} className={styles.content}><Col xs={24} xl={16}><Card title="Savdo dinamikasi" extra="Oxirgi 7 kun"><div className={styles.chart} aria-label="Savdo dinamikasi grafigi">{[38,55,44,72,66,88,76].map((height, index) => <div key={index}><span style={{ height: `${height}%` }} /><small>{['Du','Se','Ch','Pa','Ju','Sh','Ya'][index]}</small></div>)}</div></Card></Col><Col xs={24} xl={8}><Card title="Hududiy faollik"><Table pagination={false} size="small" dataSource={activity} columns={[{ title: 'Hudud', dataIndex: 'region' }, { title: 'Buyurtma', dataIndex: 'orders' }, { title: 'Ulush', render: (_, row) => <Progress percent={row.share} size="small" /> }]} /></Card></Col></Row>
  </main>;
}
