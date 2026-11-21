import { CircleMinus, ImageIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import type { AffiliateOffer } from '../model/offerTypes';
import { CreativesChip } from './CreativesChip';
import styles from './OfferCardView.module.css';

/** Offer rasmi: rasm bo'lmasa — kulrang o'rin va ikonka (sotuvchi-offerlar). */
export function OfferPhoto({ offer, className }: { offer: Pick<AffiliateOffer, 'imageUrl' | 'name'>; className: string }) {
  return (
    <span className={className}>
      <ImageIcon aria-hidden />
      {offer.imageUrl ? <SafeImage src={offer.imageUrl} alt={offer.name} loading="lazy" /> : null}
    </span>
  );
}

interface OfferCardViewProps {
  offer: AffiliateOffer;
  /** Offer tafsiloti; `null` — havolasiz ko'rinish (admin «Sotuvchi sifatida ko'rish»). */
  href: string | null;
  /** Karta pastidagi amal («Sahifa yaratish» va uning holatlari). */
  action: ReactNode;
}

/**
 * Offer kartasi (sotuvchi-offerlar): rasm, nom, haq, narx, EPC / tasdiq / sotilish, qoldiq va amal.
 * Sotuvchi katalogi va admin oldindan ko'rishi (admin-mahsulotlar 3) bir xil kartani ko'rsatadi.
 */
export function OfferCardView({ offer, href, action }: OfferCardViewProps) {
  const { t } = useTranslation();
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const titleId = `offer-${offer.productId}`;
  const hasStats = offer.epc !== null || offer.approveRate !== null || offer.saleRate !== null;
  const dash = '—';
  const media = (
    <>
      <OfferPhoto offer={offer} className={styles.photo} />
      <CreativesChip creatives={offer.creatives} className={styles.creatives} />
    </>
  );

  return (
    <article className={styles.card} aria-labelledby={titleId} data-testid="offer-card">
      {href ? <Link to={href} className={styles.media} tabIndex={-1} aria-hidden>{media}</Link> : <span className={styles.media}>{media}</span>}
      <div className={styles.cardBody}>
        <h3 id={titleId} className={styles.cardTitle}>{href ? <Link to={href}>{offer.name}</Link> : offer.name}</h3>
        {offer.categoryName ? <p className={styles.category}>{offer.categoryName}</p> : null}
        <div className={styles.fee}>
          <span className={styles.feeLabel}>{t('offers.fee')}</span>
          <span className={styles.feeValue}>{sum(offer.affiliateFee)}</span>
          <span className={styles.feeHint}>{t('offers.feeHint')}</span>
        </div>
        <p className={styles.price}>
          <span className={styles.strong}>{sum(offer.approvedPrice)}</span>{' '}
          {offer.centerDeliveryFee ? <span className={styles.nowrap}>{t('offers.plusDelivery', { amount: sum(offer.centerDeliveryFee) })}</span> : null}
        </p>
        {hasStats ? (
          <dl className={styles.stats}>
            <div className={styles.statsWide}>
              <dt>{t('offers.epc')}</dt>
              <dd>{offer.epc === null ? dash : sum(offer.epc)}</dd>
            </div>
            <div>
              <dt>{t('offers.approveRate')}</dt>
              <dd>{offer.approveRate === null ? dash : `${offer.approveRate}%`}</dd>
            </div>
            <div>
              <dt>{t('offers.saleRate')}</dt>
              <dd>{offer.saleRate === null ? dash : `${offer.saleRate}%`}</dd>
            </div>
          </dl>
        ) : (
          <p className={`${styles.stats} ${styles.noStats}`}>{t('offers.noStats')}</p>
        )}
        <div className={styles.stock}>
          <span>
            {t('offers.stock')} <span className={styles.strong}>{offer.stock > 0 ? t('offers.stockCount', { count: formatMoney(offer.stock) }) : 0}</span>
          </span>
          {offer.stock <= 0 ? (
            <span className={styles.stockChip}>
              <CircleMinus aria-hidden />
              {t('offers.outOfStock')}
            </span>
          ) : null}
        </div>
        <div className={styles.cardAction}>{action}</div>
      </div>
    </article>
  );
}
