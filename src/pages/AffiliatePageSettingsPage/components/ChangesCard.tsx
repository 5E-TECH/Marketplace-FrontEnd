import { CircleCheck, CircleX, Clock, Lock } from 'lucide-react';
import { feeAt, markupOf, markupShare, priceIssue } from '../../../features/affiliate/lib/offerMath';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { PricedOffer } from '../model/pricedOffer';
import styles from '../AffiliatePageSettingsPage.module.css';

interface ChangesCardProps {
  offer: PricedOffer;
  savedPrice: number;
  price: number | null;
  dirty: boolean;
  /** Narx yoki piksel xatosi — saqlab bo'lmaydi. */
  invalid: boolean;
  saving: boolean;
  justSaved: boolean;
  readOnly: boolean;
  onSave: () => void;
  onReset: () => void;
  phone: boolean;
}

/** «O‘zgarishlar» (sotuvchi-sahifa-sozlash, o'ngda yopishqoq): haq hisobi, eski → yangi, «Saqlash» / «Bekor qilish». */
export function ChangesCard({ offer, savedPrice, price, dirty, invalid, saving, justSaved, readOnly, onSave, onReset, phone }: ChangesCardProps) {
  const { t } = useTranslation();
  const delivery = offer.centerDeliveryFee ?? 0;
  const priceBad = price === null || priceIssue(offer, price) !== null;
  const current = priceBad ? null : price;
  const shownPrice = current ?? savedPrice;
  const fee = feeAt(offer, shownPrice);
  const markup = markupOf(offer, shownPrice);
  const oldFee = feeAt(offer, savedPrice);
  const priceChanged = price !== savedPrice;

  const badge = readOnly
    ? <Badge tone="neutral" icon={Lock}>{t('settings.readOnly')}</Badge>
    : invalid
      ? <Badge tone="danger" icon={CircleX}>{t('settings.cannotSave')}</Badge>
      : dirty
        ? <Badge tone="warning" icon={Clock}>{t('settings.unsaved')}</Badge>
        : <Badge tone="success" icon={CircleCheck}>{t('settings.allSaved')}</Badge>;

  const row = (label: string, before: number, after: number | null) => (
    <div>
      <span>{label}</span>
      <span>
        {priceChanged && !readOnly ? (
          <>
            <span className={styles.old}>{formatMoney(before)}</span> → <strong data-error={after === null || undefined}>{after === null ? '—' : formatMoney(after)}</strong>
          </>
        ) : (
          <strong>{formatMoney(before)}</strong>
        )}
      </span>
    </div>
  );

  return (
    <aside className={styles.changes} aria-labelledby="changes-h" data-testid="changes-card">
      <div className={styles.changesHead}>
        <h2 id="changes-h">{t('settings.changes')}</h2>
        {badge}
      </div>
      {priceBad && !readOnly ? (
        <div className={styles.errorBox}>
          <span>{t('settings.outOfRange')}</span>
          <span>{t('settings.outOfRangeText', { min: formatMoney(offer.approvedPrice), max: formatMoney(offer.maxSalePrice) })}</span>
        </div>
      ) : (
        <div className={styles.feeBox}>
          <span>{t('settings.perSale')}</span>
          <p>{t('affiliateHome.sum', { amount: formatMoney(fee) })}</p>
          <p>
            {markup > 0
              ? t('settings.feeFormula', { fee: formatMoney(offer.affiliateFee), share: formatMoney(markupShare(markup)), markup: formatMoney(markup) })
              : t('settings.feeNoMarkup')}
          </p>
        </div>
      )}
      <div className={styles.changeRows}>
        {row(t('settings.rowPrice'), savedPrice, price)}
        {row(t('settings.rowTotal'), savedPrice + delivery, current === null ? null : current + delivery)}
        {row(t('settings.rowFee'), oldFee, current === null ? null : feeAt(offer, current))}
      </div>
      <p className={styles.small}>{t('settings.shareNote')}</p>
      {readOnly ? (
        <p className={styles.small}>{t('settings.readOnlyNote')}</p>
      ) : justSaved && !dirty ? (
        <p className={styles.small}>{t('settings.savedNote')}</p>
      ) : phone ? null : (
        <div className={styles.changeActions}>
          <button type="button" className={styles.save} onClick={onSave} disabled={!dirty || invalid || saving} aria-busy={saving || undefined}>
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
          <button type="button" className={styles.reset} onClick={onReset} disabled={!dirty || saving}>
            {t('offer.cancel')}
          </button>
          {invalid ? <p className={styles.small}>{t('settings.fixFirst')}</p> : null}
        </div>
      )}
    </aside>
  );
}
