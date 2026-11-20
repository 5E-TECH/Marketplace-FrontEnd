import { Tooltip } from 'antd';
import { CircleMinus, CircleX, ImageIcon, Loader2, Plus, RotateCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AffiliateOffer } from '../../../features/affiliate/api/offersApi';
import { CreativesChip } from '../../../features/affiliate/ui/CreativesChip';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import type { CreateState } from '../model/createState';
import styles from '../AffiliateOffersPage.module.css';

interface OfferCardProps {
  offer: AffiliateOffer;
  /** Ekrandagi yagona asosiy (ko'k) tugma — tanlangan yoki birinchi ochiq karta. */
  primary: boolean;
  state: CreateState | undefined;
  onCreate: () => void;
}

/** Offer rasmi: rasm bo'lmasa — kulrang o'rin va ikonka (sotuvchi-offerlar). */
export function OfferPhoto({ offer, className }: { offer: Pick<AffiliateOffer, 'imageUrl' | 'name'>; className: string }) {
  return (
    <span className={className}>
      <ImageIcon aria-hidden />
      {offer.imageUrl ? <SafeImage src={offer.imageUrl} alt={offer.name} loading="lazy" /> : null}
    </span>
  );
}

/** «Sahifa yaratish» va uning holatlari: yaratilmoqda, xato (qayta urinish), qoldiq 0 (yopiq, sababi maslahatda). */
export function CreateButton({ offer, primary, state, onCreate, size = 'lg' }: Omit<OfferCardProps, 'offer'> & { offer: AffiliateOffer; size?: 'lg' | 'sm' }) {
  const { t } = useTranslation();
  const noStock = offer.stock <= 0 || state?.kind === 'noStock';
  if (noStock) {
    return (
      <Tooltip title={t('offers.noStockTip')}>
        <span className={styles.createWrap} tabIndex={0} aria-label={`${t('offers.create')}: ${t('offers.noStockTip')}`}>
          <button type="button" className={styles.create} data-size={size} disabled>
            <Plus aria-hidden />
            {t('offers.create')}
          </button>
        </span>
      </Tooltip>
    );
  }
  const creating = state?.kind === 'creating';
  const failed = state?.kind === 'failed';
  return (
    <button
      type="button"
      className={styles.create}
      data-size={size}
      data-primary={primary || creating || failed || undefined}
      aria-busy={creating || undefined}
      onClick={creating ? undefined : onCreate}
    >
      {creating ? <Loader2 className={styles.spin} aria-hidden /> : failed ? <RotateCw aria-hidden /> : <Plus aria-hidden />}
      {creating ? t('offers.creating') : failed ? t('offers.retry') : t('offers.create')}
    </button>
  );
}

export function CreateError({ state }: { state: CreateState | undefined }) {
  const { t } = useTranslation();
  if (state?.kind !== 'failed' && state?.kind !== 'noStock') return null;
  return (
    <p className={styles.createError} role="alert">
      <CircleX aria-hidden />
      {t(state.kind === 'noStock' ? 'offers.createNoStock' : 'offers.createFailed')}
    </p>
  );
}

/** Offer kartasi (sotuvchi-offerlar): rasm, nom, haq, narx, EPC / tasdiq / sotilish, qoldiq, «Sahifa yaratish». */
export function OfferCard({ offer, primary, state, onCreate }: OfferCardProps) {
  const { t } = useTranslation();
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const titleId = `offer-${offer.productId}`;
  const hasStats = offer.epc !== null || offer.approveRate !== null || offer.saleRate !== null;
  const dash = '—';

  return (
    <article className={styles.card} aria-labelledby={titleId} data-testid="offer-card">
      <Link to={`/affiliate/offers/${offer.productId}`} className={styles.media} tabIndex={-1} aria-hidden>
        <OfferPhoto offer={offer} className={styles.photo} />
        <CreativesChip creatives={offer.creatives} className={styles.creatives} />
      </Link>
      <div className={styles.cardBody}>
        <h3 id={titleId} className={styles.cardTitle}>
          <Link to={`/affiliate/offers/${offer.productId}`}>{offer.name}</Link>
        </h3>
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
        <div className={styles.cardAction}>
          <CreateButton offer={offer} primary={primary} state={state} onCreate={onCreate} />
          <CreateError state={state} />
        </div>
      </div>
    </article>
  );
}
