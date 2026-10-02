import axios from 'axios';
import { ArrowLeft, Image as ImageIcon, ShoppingBag, Star, Store } from 'lucide-react';
import { Typography } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { useStorefrontProductQuery } from '../../features/storefront/api/storefrontQueries';
import { getProductCover } from '../../features/products/lib/getProductCover';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { MoneyText } from '../../shared/ui/MoneyText/MoneyText';
import styles from './StorefrontProductPage.module.css';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function StorefrontProductPage() {
  const { productId = '' } = useParams();
  const { t } = useTranslation();
  const query = useStorefrontProductQuery(productId);
  const notFound = axios.isAxiosError(query.error) && query.error.response?.status === 404;

  if (query.isPending) return <main className={styles.state}><ContentState state="loading" /></main>;
  if (query.isError || !query.data || query.data.shop.status !== 'ACTIVE') {
    return (
      <main className={styles.state}>
        <ContentState
          state={notFound ? 'empty' : 'error'}
          title={notFound ? t('storefront.productUnavailable') : t('storefront.loadError')}
          description={notFound ? t('storefront.productUnavailableDescription') : t('storefront.loadErrorDescription')}
          {...(!notFound ? { onAction: () => void query.refetch() } : {})}
        />
      </main>
    );
  }

  const { product, shop } = query.data;
  const shopUrl = `/dokon/${encodeURIComponent(shop.slug)}`;
  const productImage = getProductCover(product);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} to={shopUrl}><span><ShoppingBag /></span>MarketHub</Link>
      </header>
      <main className={styles.content}>
        <Link className={styles.back} to={shopUrl}><ArrowLeft /> {t('storefront.backToShop')}</Link>
        <section className={styles.product}>
          <div className={styles.media}>
            <span className={styles.imageFallback}><ImageIcon />{t('storefront.noImage')}</span>
            {productImage ? <img src={productImage} alt={product.name} onError={(event) => event.currentTarget.remove()} /> : null}
          </div>
          <div className={styles.details}>
            {product.category ? <span className={styles.category}>{product.category}</span> : null}
            <Typography.Title level={1}>{product.name}</Typography.Title>
            <span className={styles.rating}><Star fill="currentColor" /> {product.rating > 0 ? product.rating.toFixed(1) : '—'}</span>
            <Typography.Paragraph>{product.description}</Typography.Paragraph>
            <div className={styles.price}><MoneyText value={product.price} strong />{product.oldPrice ? <del><MoneyText value={product.oldPrice} /></del> : null}</div>

            <div className={styles.sellerLabel}>{t('storefront.soldBy')}</div>
            <Link className={styles.shopCard} to={shopUrl} aria-label={`${shop.name} do‘koniga o‘tish`}>
              <span className={styles.logoFallback}>{initials(shop.name)}</span>
              {shop.logoUrl ? <img src={shop.logoUrl} alt="" onError={(event) => event.currentTarget.remove()} /> : null}
              <span className={styles.shopName}><strong>{shop.name}</strong><small><Store /> {t('storefront.verified')}</small></span>
              <ArrowLeft className={styles.shopArrow} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
