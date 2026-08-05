import { Camera as CameraOutlined, CircleCheckBig as CheckCircleFilled, Store as ShopOutlined } from 'lucide-react';
import { Button, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import type { ShopProfile } from '../model/shopProfile';
import type { SellerShopStatus } from '../api/sellerShopApi';
import styles from '../../../pages/ShopPage/ShopPage.module.css';

interface ShopProfileHeroProps {
  profile: ShopProfile;
  editing: boolean;
  status: SellerShopStatus;
  onImageSelect: (kind: 'logo' | 'banner', file: File) => void;
}

export function ShopProfileHero({
  profile,
  editing,
  status,
  onImageSelect,
}: ShopProfileHeroProps) {
  const createUploadProps = (
    kind: 'logo' | 'banner',
  ): UploadProps => ({
    accept: 'image/jpeg,image/png,image/webp',
    showUploadList: false,
    beforeUpload: (file) => {
      onImageSelect(kind, file);
      return false;
    },
  });

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
        {editing ? (
          <Upload {...createUploadProps('banner')}>
            <Button
              className={styles.bannerAction}
              icon={<CameraOutlined />}
              aria-label="Banner rasmini almashtirish"
            >
              Bannerni almashtirish
            </Button>
          </Upload>
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
          {editing ? (
            <Upload {...createUploadProps('logo')}>
              <Button
                className={styles.logoAction}
                shape="circle"
                icon={<CameraOutlined />}
                aria-label="Logo rasmini almashtirish"
              />
            </Upload>
          ) : null}
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
            market.elchi.uz/{profile.slug}
          </Typography.Text>
          <Typography.Paragraph ellipsis={{ rows: 2 }}>
            {profile.description}
          </Typography.Paragraph>
        </div>
      </div>
    </section>
  );
}
