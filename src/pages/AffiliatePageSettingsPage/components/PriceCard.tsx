import { CircleX, Info } from 'lucide-react';
import { useId } from 'react';
import { markupLimitPercent, priceIssue } from '../../../features/affiliate/lib/offerMath';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { MoneyInput } from '../../../shared/ui/MoneyInput/MoneyInput';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { PricedOffer } from '../model/pricedOffer';
import styles from '../AffiliatePageSettingsPage.module.css';

const STEP = 1_000;

interface PriceCardProps {
  offer: PricedOffer;
  price: number | null;
  onChange: (price: number | null) => void;
  readOnly: boolean;
}

/**
 * «Narx» (sotuvchi-sahifa-sozlash 1): maydon va chegaraga surgich — tasdiqlangan narxdan ustama
 * chegarasigacha (NRX-4); tashqarida — xato, saqlanmaydi. Yetkazish narxi o'zgarmaydi.
 */
export function PriceCard({ offer, price, onChange, readOnly }: PriceCardProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const hintId = useId();
  const value = price ?? 0;
  const issue = price === null ? 'below' : priceIssue(offer, value);
  const span = Math.max(1, offer.maxSalePrice - offer.approvedPrice);
  const share = Math.min(1, Math.max(0, (value - offer.approvedPrice) / span));
  const delivery = offer.centerDeliveryFee ?? 0;
  const range = t('settings.priceRange', { min: formatMoney(offer.approvedPrice), max: formatMoney(offer.maxSalePrice) });
  const shown = issue === 'above' ? offer.maxSalePrice : issue === 'below' ? offer.approvedPrice : value;

  return (
    <section className={styles.card} aria-labelledby="price-h" data-testid="price-card">
      <div className={styles.cardHead}>
        <h2 id="price-h">{t('settings.price')}</h2>
        <span>{t('settings.priceHint')}</span>
      </div>
      <div className={styles.priceRow}>
        <div className={styles.priceField}>
          <label htmlFor={inputId} className={styles.fieldLabel}>{t('settings.priceLabel')}</label>
          <MoneyInput
            id={inputId}
            size="large"
            value={price}
            onChange={onChange}
            disabled={readOnly}
            status={issue ? 'error' : undefined}
            aria-invalid={Boolean(issue) || undefined}
            aria-describedby={hintId}
          />
          {issue ? (
            <p id={hintId} className={styles.fieldError} role="alert">
              <CircleX aria-hidden />
              {issue === 'above' ? t('settings.priceAbove', { range }) : t('settings.priceBelow', { min: formatMoney(offer.approvedPrice) })}
            </p>
          ) : (
            <p id={hintId} className={styles.fieldHint}>{t('settings.priceRangeHint', { range })}</p>
          )}
        </div>
        <div className={styles.slider} data-error={issue || undefined}>
          <div className={styles.bubbleRow}>
            <span className={styles.bubble} style={{ left: `clamp(0px, calc(${share * 100}% - 32px), calc(100% - 64px))` }} aria-hidden>
              {formatMoney(price ?? 0)}
            </span>
          </div>
          <div className={styles.track}>
            <span className={styles.fill} style={{ width: `${(issue === 'above' ? 1 : issue === 'below' ? 0 : share) * 100}%` }} />
            <span className={styles.thumb} style={{ left: `calc(${(issue === 'above' ? 1 : issue === 'below' ? 0 : share) * 100}% - ${issue === 'below' ? 0 : 4}px)` }} />
            <input
              type="range"
              className={styles.rangeInput}
              min={offer.approvedPrice}
              max={offer.maxSalePrice}
              step={STEP}
              value={shown}
              disabled={readOnly}
              aria-label={t('settings.priceSlider')}
              aria-valuetext={t('affiliateHome.sum', { amount: formatMoney(shown) })}
              onChange={(event) => onChange(Number(event.target.value))}
            />
          </div>
          <div className={styles.ends}>
            <span><strong>{formatMoney(offer.approvedPrice)}</strong><span>{t('settings.approvedPrice')}</span></span>
            <span><strong>{formatMoney(offer.maxSalePrice)}</strong><span>{t('settings.limit', { percent: markupLimitPercent(offer) })}</span></span>
          </div>
        </div>
      </div>
      <div className={styles.breakdown}>
        <div>
          <span>{t('settings.approvedRow')}</span>
          <span><strong>{t('affiliateHome.sum', { amount: formatMoney(offer.approvedPrice) })}</strong><span>{t('settings.approvedRowHint')}</span></span>
        </div>
        <div>
          <span>{t('settings.markupRow')}</span>
          <span>
            <strong>{t('settings.markupValue', { percent: markupLimitPercent(offer), amount: formatMoney(offer.maxSalePrice - offer.approvedPrice) })}</strong>
            <span>{t('settings.markupRowHint')}</span>
          </span>
        </div>
        <div>
          <span>{t('settings.customerRow')}</span>
          <span>
            <strong>{t('settings.customerValue', { price: formatMoney(issue ? offer.approvedPrice : value), delivery: formatMoney(delivery), total: formatMoney((issue ? offer.approvedPrice : value) + delivery) })}</strong>
            <span>{offer.addressDeliveryFee ? t('settings.customerRowHint', { door: formatMoney(offer.addressDeliveryFee) }) : t('settings.customerRowCenter')}</span>
          </span>
        </div>
      </div>
      <p className={styles.note}>
        <Info aria-hidden />
        {t('settings.priceNote')}
      </p>
    </section>
  );
}
