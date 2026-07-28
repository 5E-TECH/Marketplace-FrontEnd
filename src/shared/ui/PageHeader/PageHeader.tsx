import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: ReactNode;
}

export function PageHeader({ title, description, extra }: PageHeaderProps) {
  return (
    <Flex className={styles.header} justify="space-between" align="flex-start" gap={16}>
      <div>
        <Typography.Title level={1} className={styles.title}>
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Text type="secondary">{description}</Typography.Text>
        ) : null}
      </div>
      {extra}
    </Flex>
  );
}
