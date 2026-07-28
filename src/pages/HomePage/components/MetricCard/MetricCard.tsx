import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Card, Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import styles from './MetricCard.module.css';

type MetricTone = 'violet' | 'blue' | 'emerald' | 'amber';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  tone: MetricTone;
  trend?: number;
  hint: string;
}

export function MetricCard({
  title,
  value,
  icon,
  tone,
  trend,
  hint,
}: MetricCardProps) {
  const positive = trend !== undefined && trend >= 0;

  return (
    <Card className={`${styles.card} ${styles[`${tone}Card`]}`}>
      <Flex justify="space-between" align="flex-start">
        <span className={`${styles.icon} ${styles[tone]}`}>{icon}</span>
        {trend !== undefined ? (
          <span className={`${styles.trend} ${positive ? styles.positive : styles.negative}`}>
            {positive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {Math.abs(trend)}%
          </span>
        ) : null}
      </Flex>
      <Typography.Text className={styles.title}>{title}</Typography.Text>
      <Typography.Title level={3} className={styles.value}>{value}</Typography.Title>
      <Flex justify="space-between" align="flex-end">
        <Typography.Text className={styles.hint}>{hint}</Typography.Text>
        <svg className={`${styles.sparkline} ${styles[`${tone}Line`]}`} viewBox="0 0 72 28" aria-hidden>
          <polyline points="1,25 12,17 22,21 34,10 45,15 57,5 70,7" />
        </svg>
      </Flex>
    </Card>
  );
}
