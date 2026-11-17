import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useInShell, usePageTitle } from './pageTitle';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  before?: ReactNode;
  extra?: ReactNode;
}

/**
 * Panel karkasi ichida nom yuqori qatorga chiqadi, «Orqaga» havolasini karkas
 * o'zi qo'yadi — bu yerda faqat izoh va sahifa amallari (asboblar qatori) qoladi.
 * Karkassiz joyda (masalan test sahifasi) to'liq sarlavha chiziladi.
 */
export function PageHeader({ title, description, before, extra }: PageHeaderProps) {
  const inShell = useInShell();
  usePageTitle(title);

  if (inShell) {
    if (!description && !extra) return null;
    return (
      <Flex className={styles.toolbar} justify="space-between" align="center" gap={12} wrap>
        {description ? <Typography.Text type="secondary" className={styles.description}>{description}</Typography.Text> : <span />}
        {extra}
      </Flex>
    );
  }

  return (
    <Flex className={styles.header} justify="space-between" align="flex-start" gap={16}>
      <div className={styles.heading}>
        {before ? <div className={styles.before}>{before}</div> : null}
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
