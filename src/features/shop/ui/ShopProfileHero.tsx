import { CircleCheckBig as CheckCircleFilled, Store as ShopOutlined } from 'lucide-react';
import { Tag, Typography } from 'antd';
import type { ShopProfile } from '../model/shopProfile';
import type { SellerShopStatus } from '../api/sellerShopApi';
import styles from './ShopProfileHero.module.css';

interface ShopProfileHeroProps {
  profile: ShopProfile;
  status: SellerShopStatus;
}

export function ShopProfileHero({
  profile,
  status,
}: ShopProfileHeroProps) {
  return (
    <section className={styles.hero} aria-label="Do‘kon ko‘rinishi">
      <div
        className={styles.banner}
        style={
          profile.bannerUrl
            ? { backgroundImage: `url(${profile.bannerUrl})` }
            : undefined
        }
      >
        <div className={styles.bannerOverlay} />
        {!profile.bannerUrl ? (
          <div className={styles.bannerPlaceholder}>
            <ShopOutlined />
            <span>Do‘kon banneri</span>
          </div>
        ) : null}

      </div>

      <div className={styles.identity}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt={`${profile.name} logotipi`} />
            ) : (
              <ShopOutlined aria-hidden />
            )}
          </div>
  
        </div>

        <div className={styles.identityCopy}>
          <div className={styles.nameRow}>
            <Typography.Title level={2}>{profile.name}</Typography.Title>
            <Tag
              icon={<CheckCircleFilled />}
              color={status === 'ACTIVE' ? 'success' : status === 'PENDING' ? 'warning' : 'error'}
              bordered={false}
            >
              {status === 'ACTIVE'
                ? 'Faol'
                : status === 'PENDING'
                  ? 'Tekshiruvda'
                  : status === 'SUSPENDED'
                    ? 'To‘xtatilgan'
                    : 'Rad etilgan'}
            </Tag>
          </div>
          <Typography.Text className={styles.storeUrl}>
            market.elchi.uz/{profile.slug || 'dokon'}
          </Typography.Text>
          <Typography.Paragraph ellipsis={{ rows: 2 }}>
            {profile.description}
          </Typography.Paragraph>
        </div>
      </div>
    </section>
  );
}
