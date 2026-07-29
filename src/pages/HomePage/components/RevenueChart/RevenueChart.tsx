import { ArrowUpOutlined, MoreOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Select, Typography } from 'antd';
import styles from './RevenueChart.module.css';

const points = [
  [0, 148],
  [45, 130],
  [90, 139],
  [135, 92],
  [180, 109],
  [225, 66],
  [270, 83],
  [315, 42],
  [360, 58],
  [405, 25],
  [450, 44],
  [500, 16],
] as const;

const linePath = points
  .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
  .join(' ');
const areaPath = `${linePath} L 500 180 L 0 180 Z`;

export function RevenueChart() {
  return (
    <Card className={styles.card}>
      <Flex justify="space-between" align="flex-start" gap={16}>
        <div>
          <Typography.Text className={styles.eyebrow}>DAROMAD ANALITIKASI</Typography.Text>
          <Flex align="baseline" gap={10} wrap>
            <Typography.Title level={2} className={styles.value}>
              24 520 000 so‘m
            </Typography.Title>
            <span className={styles.growth}><ArrowUpOutlined /> 18.2%</span>
          </Flex>
          <Typography.Text type="secondary">
            O‘tgan oyga nisbatan +3 780 000 so‘m
          </Typography.Text>
        </div>
        <Flex gap={8}>
          <Select
            defaultValue="30"
            className={styles.period}
            options={[
              { value: '7', label: '7 kun' },
              { value: '30', label: '30 kun' },
              { value: '90', label: '3 oy' },
            ]}
          />
          <Button type="text" icon={<MoreOutlined />} aria-label="Chart amallari" />
        </Flex>
      </Flex>

      <div className={styles.chart}>
        <div className={styles.yAxis}>
          <span>30M</span><span>20M</span><span>10M</span><span>0</span>
        </div>
        <svg
          viewBox="0 0 500 180"
          preserveAspectRatio="none"
          role="img"
          aria-label="Oxirgi 30 kundagi daromad o‘sish grafigi"
        >
          <defs>
            <linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB923C" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#FB923C" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="revenue-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
          {[20, 60, 100, 140, 180].map((y) => (
            <line key={y} x1="0" y1={y} x2="500" y2={y} className={styles.gridLine} />
          ))}
          <path d={areaPath} fill="url(#revenue-area)" />
          <path d={linePath} fill="none" stroke="url(#revenue-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx="500" cy="16" r="5" fill="#151C2F" stroke="#FB923C" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <Flex justify="space-between" className={styles.xAxis}>
        <span>1-iyul</span><span>7-iyul</span><span>14-iyul</span><span>21-iyul</span><span>27-iyul</span>
      </Flex>
    </Card>
  );
}
