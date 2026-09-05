import { Flex, Spin } from 'antd';
import styles from './PageLoader.module.css';

interface PageLoaderProps {
  compact?: boolean;
}

export function PageLoader({ compact = false }: PageLoaderProps) {
  return (
    <Flex
      className={`${styles.loader} ${compact ? styles.compact : ''}`}
      align="center"
      justify="center"
      role="status"
    >
      <Spin size="large" tip="Yuklanmoqda...">
        <span className={styles.placeholder} />
      </Spin>
    </Flex>
  );
}
