import { ShoppingBag as ShoppingFilled } from 'lucide-react';
import { Flex, Typography } from 'antd';
import styles from './LoginBrand.module.css';

interface LoginBrandProps {
  titleId?: string;
}

export function LoginBrand({ titleId = 'login-title' }: LoginBrandProps) {
  return (
    <Flex className={styles.brand} vertical align="center">
      <span className={styles.iconWrapper} aria-hidden>
        <ShoppingFilled />
      </span>
      <Typography.Title id={titleId} level={1} className={styles.name}>
        MarketHub
      </Typography.Title>
      <Typography.Text className={styles.tagline}>
        O‘zbekistonning eng yaxshi marketplace
      </Typography.Text>
    </Flex>
  );
}
