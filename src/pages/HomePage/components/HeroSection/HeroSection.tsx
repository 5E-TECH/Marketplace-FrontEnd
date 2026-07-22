import { ShoppingOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Typography } from 'antd';
import styles from './HeroSection.module.css';

export function HeroSection() {
  return (
    <section aria-labelledby="marketplace-hero-title">
      <Card className={styles.hero}>
        <Flex vertical align="center" gap="middle">
          <ShoppingOutlined className={styles.icon} aria-hidden />
          <Typography.Title id="marketplace-hero-title" className={styles.title}>
            Marketplace’ga xush kelibsiz
          </Typography.Title>
          <Typography.Paragraph type="secondary" className={styles.description}>
            Ishonchli mahsulotlarni qulay va tez toping.
          </Typography.Paragraph>
          <Button type="primary" size="large">
            Mahsulotlarni ko‘rish
          </Button>
        </Flex>
      </Card>
    </section>
  );
}
