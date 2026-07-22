import { Flex, Spin } from 'antd';
import styles from './PageLoader.module.css';

export function PageLoader() {
  return (
    <Flex className={styles.loader} align="center" justify="center" role="status">
      <Spin size="large" tip="Yuklanmoqda...">
        <span className={styles.placeholder} />
      </Spin>
    </Flex>
  );
}
