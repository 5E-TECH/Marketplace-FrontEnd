import { Tooltip } from 'antd';
import { CircleX, Loader2, Plus, RotateCw } from 'lucide-react';
import type { AffiliateOffer } from '../../../features/affiliate/api/offersApi';
import { OfferCardView } from '../../../features/affiliate/ui/OfferCardView';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import type { CreateState } from '../model/createState';
import styles from '../AffiliateOffersPage.module.css';

interface OfferCardProps {
  offer: AffiliateOffer;
  /** Ekrandagi yagona asosiy (ko'k) tugma — tanlangan yoki birinchi ochiq karta. */
  primary: boolean;
  state: CreateState | undefined;
  onCreate: () => void;
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

/** Offer kartasi (sotuvchi-offerlar) va uning «Sahifa yaratish» amali. */
export function OfferCard({ offer, primary, state, onCreate }: OfferCardProps) {
  return (
    <OfferCardView
      offer={offer}
      href={`/affiliate/offers/${offer.productId}`}
      action={(
        <>
          <CreateButton offer={offer} primary={primary} state={state} onCreate={onCreate} />
          <CreateError state={state} />
        </>
      )}
    />
  );
}
