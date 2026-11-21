import { CircleX, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AdminProductListItem } from '../../../features/adminProducts/model/adminProductTypes';
import { productBadgeCode } from '../../../features/adminProducts/ui/adminProductModerationConfig';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { isOutOfStock, productHref, reasonMeta, statusMeta } from '../model/productRows';
import styles from '../AdminProductsPage.module.css';

export function ProductThumb({ product }: { product: AdminProductListItem }) {
  const { t } = useTranslation();
  return (
    <span className={styles.thumb} title={t('products.photo')}>
      <ImageIcon aria-hidden />
      {product.images[0] ? <SafeImage src={product.images[0]} alt="" loading="lazy" /> : null}
    </span>
  );
}

/** Nomi (karta havolasi) va «Kategoriya · Optovik». */
export function ProductIdentity({ product, categoryName, link = true }: { product: AdminProductListItem; categoryName: string | null; link?: boolean }) {
  return (
    <span className={styles.identity}>
      {link ? <Link to={productHref(product)} className={styles.name}>{product.name}</Link> : <span className={styles.name}>{product.name}</span>}
      <span className={styles.sub}>{[categoryName, product.shop?.name].filter(Boolean).join(' · ')}</span>
    </span>
  );
}

export function StatusBadges({ product }: { product: AdminProductListItem }) {
  return (
    <span className={styles.badges}>
      <StatusBadge family="product" code={productBadgeCode(product)} />
      {isOutOfStock(product) ? <StatusBadge family="product" code="OUT_OF_STOCK" /> : null}
    </span>
  );
}

/** Holat belgilari va ostida vaqt (va kim). */
export function StatusCell({ product }: { product: AdminProductListItem }) {
  const { t } = useTranslation();
  return (
    <span className={styles.statusCell}>
      <StatusBadges product={product} />
      <span className={styles.meta}>{statusMeta(product, (date) => t('products.since', { date }))}</span>
    </span>
  );
}

/** «Narx — mijoz ko'radi»: tasdiqlangan narx yoki tavsiya; yetkazish va rejim; optovik va haq. */
export function PriceCell({ product }: { product: AdminProductListItem }) {
  const { t } = useTranslation();
  const price = product.listPrice;
  if (!price) return <span className={styles.muted}>—</span>;
  const delivery = price.deliveryMode === 'FREE' ? t('products.deliveryFree') : t('products.delivery', {
    amount: formatMoney(price.delivery),
    mode: t(`products.mode.${price.deliveryMode}` as TranslationKey),
  });
  return (
    <span className={styles.stack}>
      <span className={styles.price}>
        {t('products.sum', { amount: formatMoney(price.customer) })}
        {price.recommended ? <span> {t('products.recommended')}</span> : null}
      </span>
      <span className={styles.sub}>{delivery}</span>
      <span className={styles.sub}>
        {t('products.baseFee', { base: product.basePrice === null ? '—' : formatMoney(product.basePrice), fee: product.affiliateFee === null ? '—' : formatMoney(product.affiliateFee) })}
      </span>
    </span>
  );
}

/** «Qoldiq»: sotuvga mavjud (omborda − band); postavka bo'lmasa «—». Planshetda omborda va band ikki qatorda. */
export function StockCell({ product }: { product: AdminProductListItem }) {
  const { t } = useTranslation();
  const stock = product.stock;
  if (!stock) {
    return (
      <span className={styles.stack}>
        <span className={styles.dash}>—</span>
        <span className={styles.sub}>{t('products.noSupply')}</span>
      </span>
    );
  }
  return (
    <span className={styles.stack}>
      <span className={styles.stockCount}>{formatMoney(stock.available)}</span>
      <span className={`${styles.sub} ${styles.wideOnly}`}>{t('products.onHand', { count: formatMoney(stock.onHand), reserved: formatMoney(stock.reserved) })}</span>
      <span className={`${styles.sub} ${styles.narrowOnly}`}>{t('products.onHandOnly', { count: formatMoney(stock.onHand) })}</span>
      <span className={`${styles.sub} ${styles.narrowOnly}`}>{t('products.reservedOnly', { count: formatMoney(stock.reserved) })}</span>
    </span>
  );
}

/** «Natija»: lid va EPC, tasdiq va sotilish — faqat sotuvdagi mahsulotda. */
export function ResultCell({ product }: { product: AdminProductListItem }) {
  const { t } = useTranslation();
  if (product.status !== 'ACTIVE') {
    return (
      <span className={styles.stack}>
        <span className={styles.dash}>—</span>
        <span className={styles.sub}>{t('products.notOnSale')}</span>
      </span>
    );
  }
  const results = product.results;
  if (!results) return <span className={styles.plain}>{t('products.noStats')}</span>;
  return (
    <span className={styles.stack}>
      <span className={styles.result}>{t('products.leadsEpc', { leads: formatMoney(results.leads), epc: results.epc === null ? '—' : formatMoney(results.epc) })}</span>
      <span className={styles.sub}>{t('products.rates', { approve: results.approveRate ?? '—', sale: results.saleRate ?? '—' })}</span>
    </span>
  );
}

/** Rad etilgan yoki to'xtatilgan mahsulot sababi — qator ostida (admin-mahsulotlar «Rad etildi (1)»). */
export function ReasonLine({ product }: { product: AdminProductListItem }) {
  const { t } = useTranslation();
  const reason = product.isBlocked ? product.blockReason : product.status === 'REJECTED' ? product.moderationNote : null;
  if (!reason) return null;
  return (
    <span className={styles.reason}>
      <CircleX aria-hidden />
      <span>
        <strong>{t(product.isBlocked ? 'products.blockLine' : 'products.reasonLine', { meta: reasonMeta(product) })}</strong> {reason}
      </span>
    </span>
  );
}
