import { Boxes, CircleDollarSign, PackageCheck, ShoppingCart, TriangleAlert } from 'lucide-react';
import { Card, Col, Empty, Flex, Progress, Row, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useSellerDashboardQuery } from '../../features/dashboard/api/dashboardQueries';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { MetricCard } from './components/MetricCard/MetricCard';
import { RevenueChart } from './components/RevenueChart/RevenueChart';
import styles from './HomePage.module.css';

export default function HomePage() {
  const dashboardQuery = useSellerDashboardQuery();
  const dashboard = dashboardQuery.data;
  const maxSold = dashboard ? Math.max(...dashboard.topProducts.map(({ sold }) => sold), 1) : 1;
  return <main>
    <Flex className={styles.hero} justify="space-between" align="flex-end" gap={16}>
      <div><Typography.Text className={styles.kicker}>UMUMIY KO‘RINISH</Typography.Text><Typography.Title level={1}>Boshqaruv paneli</Typography.Title><Typography.Text type="secondary">Do‘koningizdagi muhim ko‘rsatkichlar bir joyda.</Typography.Text></div>
      <Typography.Text type="secondary">Ma’lumotlar avtomatik yangilanadi</Typography.Text>
    </Flex>
    {dashboardQuery.isPending ? <ContentState state="loading" /> : null}
    {dashboardQuery.isError ? <ContentState state="error" title="Statistikani yuklab bo‘lmadi" description={getAuthErrorMessage(dashboardQuery.error)} onAction={() => void dashboardQuery.refetch()} /> : null}
    {dashboard ? <>
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} xl={6}><MetricCard title="Jami daromad" value={`${formatMoney(dashboard.revenue)} so‘m`} icon={<CircleDollarSign />} tone="violet" hint="yetkazilgan buyurtmalardan" /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard title="Jami buyurtmalar" value={dashboard.ordersTotal} icon={<ShoppingCart />} tone="blue" hint={`${dashboard.pendingShipments} tasi kutilmoqda`} /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard title="Yetkazilgan" value={dashboard.delivered} icon={<PackageCheck />} tone="emerald" hint="muvaffaqiyatli buyurtmalar" /></Col>
      <Col xs={24} sm={12} xl={6}><MetricCard title="Kam qolgan" value={dashboard.lowStockCount} icon={<TriangleAlert />} tone="amber" hint="qoldiqni to‘ldirish kerak" /></Col>
    </Row>
    <Row gutter={[16, 16]} className={styles.section}>
      <Col xs={24} xl={16}><RevenueChart data={dashboard.salesByDay} revenue={dashboard.revenue} /></Col>
      <Col xs={24} xl={8}><Card className={styles.panel} title={<div><Typography.Text strong>Top mahsulotlar</Typography.Text><Typography.Text className={styles.panelSubtitle}>Sotilgan dona bo‘yicha</Typography.Text></div>}>
        {dashboard.topProducts.length ? <div className={styles.topProducts}>{dashboard.topProducts.map((product, index) => {
          const percent = Math.round((product.sold / maxSold) * 100);
          return <div className={styles.topProduct} key={product.productId}><Flex justify="space-between" align="center" gap={12}><Flex align="center" gap={10} className={styles.productCopy}><span className={styles.productRank}>{index + 1}</span><div><Typography.Text strong ellipsis>{product.name}</Typography.Text><Typography.Text className={styles.productSales}>{product.sold} dona sotilgan</Typography.Text></div></Flex><Typography.Text type="secondary">{percent}%</Typography.Text></Flex><Progress percent={percent} showInfo={false} size="small" strokeColor="#FB923C" /></div>;
        })}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sotuvlar boshlangach top mahsulotlar chiqadi" />}
        <Link to="/products" className={styles.stockButton}><Boxes size={16} /> Barcha mahsulotlar</Link>
      </Card></Col>
    </Row>
    </> : null}
  </main>;
}
