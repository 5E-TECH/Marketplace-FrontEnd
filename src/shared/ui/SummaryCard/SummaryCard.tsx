import { Flex } from 'antd';
import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './SummaryCard.module.css';

type SummaryTone = 'info' | 'success' | 'warning';

interface SummaryCardProps {
  title: string;
  value: string | number;
  caption: string;
  icon: ReactNode;
  tone?: SummaryTone;
}

export function SummaryCard({
  title,
  value,
  caption,
  icon,
  tone = 'info',
}: SummaryCardProps) {
  return (
    <article className={`${styles.card} ${styles[tone]}`}>
      <Flex justify="space-between" align="center">
        <span className={styles.label}>
          <span className={styles.icon}>{icon}</span>
          {title}
        </span>
        <MoreHorizontal className={styles.more} aria-hidden />
      </Flex>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}
