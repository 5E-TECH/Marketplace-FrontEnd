import {
  ArrowRight as ArrowRightOutlined,
  CalendarDays as CalendarOutlined,
  CircleCheck as CheckCircleOutlined,
  CircleDollarSign as DollarOutlined,
  Package as AppstoreOutlined,
  Plus as PlusOutlined,
  ShoppingCart as ShoppingCartOutlined,
  Store as ShopOutlined,
  TrendingUp as RiseOutlined,
  TriangleAlert as WarningOutlined,
  Users as TeamOutlined,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Flex,
  List,
  Progress,
  Row,
  Space,
  Timeline,
  Typography,
} from 'antd';
import { Link } from 'react-router-dom';
import {
  formatPrice,
  initialProducts,
  orders,
} from '../../features/seller/model/sellerData';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import { MetricCard } from './components/MetricCard/MetricCard';
import { RevenueChart } from './components/RevenueChart/RevenueChart';
import styles from './HomePage.module.css';

const revenue = orders
  .filter(({ status }) => status !== 'CANCELLED')
  .reduce((sum, order) => sum + order.total, 0);

export default function HomePage() {
  return (
    <>
      <Flex className={styles.hero} justify="space-between" align="flex-end" gap={16}>
        <div>
          <Typography.Text className={styles.kicker}>UMUMIY KO‘RINISH</Typography.Text>
          <Typography.Title level={1}>Boshqaruv paneli</Typography.Title>
          <Typography.Text type="secondary">
            Do‘koningizdagi muhim ko‘rsatkichlar bir joyda.
          </Typography.Text>
        </div>
        <Button icon={<CalendarOutlined />}>27-iyul, 2026</Button>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="Jami savdo"
            value={formatPrice(revenue)}
            icon={<DollarOutlined />}
            tone="violet"
            trend={12.4}
            hint="o‘tgan haftaga nisbatan"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="Yangi buyurtmalar"
            value={orders.filter(({ status }) => status === 'NEW').length}
            icon={<ShoppingCartOutlined />}
            tone="blue"
            trend={8.2}
            hint="bugun qabul qilindi"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="Mahsulotlar"
            value={initialProducts.length}
            icon={<AppstoreOutlined />}
            tone="emerald"
            hint="katalogdagi mahsulotlar"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricCard
            title="Kam qolgan"
            value={initialProducts.filter(({ stock }) => stock <= 5).length}
            icon={<WarningOutlined />}
            tone="amber"
            trend={-2.1}
            hint="qoldiqni yangilash kerak"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className={styles.section}>
        <Col xs={24} xl={16}>
          <RevenueChart />
        </Col>
        <Col xs={24} xl={8}>
          <Card className={`${styles.panel} ${styles.quickPanel}`}>
            <Typography.Text className={styles.panelEyebrow}>TEZKOR AMALLAR</Typography.Text>
            <Typography.Title level={3}>Bugun nimadan boshlaymiz?</Typography.Title>
            <div className={styles.quickGrid}>
              <Link to="/products/new" className={styles.quickAction}>
                <span className={styles.quickIcon}><PlusOutlined /></span>
                <span>Mahsulot qo‘shish</span>
              </Link>
              <Link to="/orders" className={styles.quickAction}>
                <span className={styles.quickIcon}><ShoppingCartOutlined /></span>
                <span>Buyurtmalar</span>
              </Link>
              <Link to="/warehouses" className={styles.quickAction}>
                <span className={styles.quickIcon}><AppstoreOutlined /></span>
                <span>Qoldiq kiritish</span>
              </Link>
              <Link to="/shop" className={styles.quickAction}>
                <span className={styles.quickIcon}><ShopOutlined /></span>
                <span>Do‘kon profili</span>
              </Link>
            </div>
            <div className={styles.inventoryHealth}>
              <Flex justify="space-between">
                <Typography.Text strong>Sklad holati</Typography.Text>
                <Typography.Text className={styles.healthValue}>82%</Typography.Text>
              </Flex>
              <Progress percent={82} showInfo={false} strokeColor={{ '0%': '#FB923C', '100%': '#2DD4BF' }} />
              <Typography.Text type="secondary">41 ta SKU barqaror qoldiqda</Typography.Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className={styles.section}>
        <Col xs={24} lg={16}>
          <Card
            className={styles.panel}
            title={
              <div>
                <Typography.Text strong>So‘nggi buyurtmalar</Typography.Text>
                <Typography.Text className={styles.panelSubtitle}>
                  Oxirgi savdo faolligi
                </Typography.Text>
              </div>
            }
            extra={<Link to="/orders">Barchasi <ArrowRightOutlined /></Link>}
          >
            <List
              dataSource={orders.slice(0, 4)}
              renderItem={(order) => (
                <List.Item className={styles.orderRow}>
                  <List.Item.Meta
                    avatar={<span className={styles.orderAvatar}>{order.customer.charAt(0)}</span>}
                    title={<Space><Typography.Text strong>{order.customer}</Typography.Text><Typography.Text className={styles.orderId}>{order.id}</Typography.Text></Space>}
                    description={order.createdAt}
                  />
                  <Flex align="center" gap={14}>
                    <Typography.Text strong>{formatPrice(order.total)}</Typography.Text>
                    <StatusTag status={order.status} />
                  </Flex>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className={styles.panel}
            title={
              <div>
                <Typography.Text strong>Top mahsulotlar</Typography.Text>
                <Typography.Text className={styles.panelSubtitle}>
                  Savdo hajmi bo‘yicha
                </Typography.Text>
              </div>
            }
          >
            <div className={styles.topProducts}>
              {initialProducts.map((product, index) => (
                <div className={styles.topProduct} key={product.id}>
                  <Flex justify="space-between" align="center">
                    <Flex align="center" gap={10}>
                      <span className={styles.productRank}>{index + 1}</span>
                      <div>
                        <Typography.Text strong>{product.name}</Typography.Text>
                        <Typography.Text className={styles.productSales}>
                          {formatPrice(product.price * Math.max(product.stock, 3))}
                        </Typography.Text>
                      </div>
                    </Flex>
                    <Typography.Text type="secondary">{72 - index * 17}%</Typography.Text>
                  </Flex>
                  <Progress percent={72 - index * 17} showInfo={false} size="small" strokeColor="#FB923C" />
                </div>
              ))}
            </div>
            <Link to="/products" className={styles.stockButton}>
              Barcha mahsulotlar
            </Link>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className={styles.section}>
        <Col xs={24} lg={12}>
          <Card className={styles.panel} title="So‘nggi faollik">
            <Timeline
              items={[
                { color: '#2DD4BF', dot: <CheckCircleOutlined />, children: <><Typography.Text strong>Buyurtma yetkazildi</Typography.Text><Typography.Text className={styles.activityMeta}>EL-1045 · 12 daqiqa oldin</Typography.Text></> },
                { color: '#FB923C', dot: <ShoppingCartOutlined />, children: <><Typography.Text strong>Yangi buyurtma qabul qilindi</Typography.Text><Typography.Text className={styles.activityMeta}>EL-1048 · 28 daqiqa oldin</Typography.Text></> },
                { color: '#FFB648', dot: <WarningOutlined />, children: <><Typography.Text strong>Smart Watch S8 qoldig‘i kamaydi</Typography.Text><Typography.Text className={styles.activityMeta}>4 dona qoldi · 1 soat oldin</Typography.Text></> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            className={styles.panel}
            title="Yangi mijozlar"
            extra={<Button type="link" icon={<TeamOutlined />}>Barchasi</Button>}
          >
            <div className={styles.customers}>
              {orders.slice(0, 4).map((order, index) => (
                <Flex key={order.id} align="center" justify="space-between" className={styles.customer}>
                  <Flex align="center" gap={10}>
                    <Avatar className={styles.customerAvatar}>{order.customer.charAt(0)}</Avatar>
                    <div>
                      <Typography.Text strong>{order.customer}</Typography.Text>
                      <Typography.Text className={styles.activityMeta}>{order.phone}</Typography.Text>
                    </div>
                  </Flex>
                  <Flex align="center" gap={4} className={styles.customerOrders}>
                    <RiseOutlined /> {index + 1} buyurtma
                  </Flex>
                </Flex>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </>
  );
}
