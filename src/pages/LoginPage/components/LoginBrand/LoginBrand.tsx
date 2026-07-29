import { ShoppingFilled } from '@ant-design/icons';
import { Flex, Typography } from 'antd';
import styles from './LoginBrand.module.css';

export function LoginBrand() {
  return (
    <Flex className={styles.brand} vertical align="center">
      <span className={styles.iconWrapper} aria-hidden>
        <ShoppingFilled />
      </span>
      <Typography.Title id="login-title" level={1} className={styles.name}>
        MarketHub
      </Typography.Title>
      <Typography.Text className={styles.tagline}>
        O‘zbekistonning eng yaxshi marketplace
      </Typography.Text>
    </Flex>
  );
}
