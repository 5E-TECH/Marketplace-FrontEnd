import { Card, Empty, Flex, Typography } from 'antd';
import type { DashboardSalesPoint } from '../../../../features/dashboard/model/dashboardTypes';
import { formatMoney } from '../../../../shared/ui/MoneyText/formatMoney';
import { formatShortDate } from '../../../../shared/lib/date';
import { memo, useMemo } from 'react';
import styles from './RevenueChart.module.css';

interface RevenueChartProps { data: DashboardSalesPoint[]; revenue: number }
const WIDTH = 500;
const HEIGHT = 180;

export const RevenueChart = memo(function RevenueChart({ data, revenue }: RevenueChartProps) {
  const { maxAmount, points, linePath, areaPath, labels } = useMemo(() => {
    const maxAmount = Math.max(...data.map(({ amount }) => amount), 1);
    const points = data.map(({ amount }, index) => ({ x: data.length === 1 ? WIDTH / 2 : (index / (data.length - 1)) * WIDTH, y: HEIGHT - (amount / maxAmount) * (HEIGHT - 16) }));
    const linePath = points.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
    const areaPath = points.length ? `${linePath} L ${points.at(-1)?.x ?? WIDTH} ${HEIGHT} L ${points[0]?.x ?? 0} ${HEIGHT} Z` : '';
    const labels = data.filter((_point, index) => index === 0 || index === data.length - 1 || index === Math.floor(data.length / 2));
    return { maxAmount, points, linePath, areaPath, labels };
  }, [data]);

  return <Card className={styles.card}>
    <Typography.Text className={styles.eyebrow}>DAROMAD ANALITIKASI</Typography.Text>
    <Typography.Title level={2} className={styles.value}>{formatMoney(revenue)} so‘m</Typography.Title>
    <Typography.Text type="secondary">Kunlik savdo dinamikasi</Typography.Text>
    {data.length ? <>
      <div className={styles.chart}>
        <div className={styles.yAxis}><span>{formatMoney(maxAmount)}</span><span>{formatMoney(Math.round(maxAmount / 2))}</span><span>0</span></div>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Kunlik daromad grafigi">
          <defs><linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-accent-bright)" stopOpacity="0.24" /><stop offset="100%" stopColor="var(--color-accent-bright)" stopOpacity="0" /></linearGradient></defs>
          {[20, 60, 100, 140, 180].map((y) => <line key={y} x1="0" y1={y} x2={WIDTH} y2={y} className={styles.gridLine} />)}
          <path d={areaPath} fill="url(#revenue-area)" />
          <path d={linePath} fill="none" stroke="var(--color-accent-bright)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => <circle key={`${data[index]?.date}-${index}`} cx={point.x} cy={point.y} r="4" fill="var(--color-surface)" stroke="var(--color-accent-bright)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
        </svg>
      </div>
      <Flex justify="space-between" className={styles.xAxis}>{labels.map(({ date }) => <span key={date}>{formatShortDate(date)}</span>)}</Flex>
    </> : <div className={styles.empty}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Savdo ma’lumoti hali mavjud emas" /></div>}
  </Card>;
});
