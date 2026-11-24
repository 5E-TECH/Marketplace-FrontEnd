import { CircleCheck } from 'lucide-react';
import { clock, dayLabel, sum } from '../../features/operator/lib/leadFormat';
import { shipDay } from '../../features/operator/lib/orderRules';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';
import type { OrderDone } from './ActiveLead';
import styles from './OrderForm.module.css';

/**
 * «Buyurtma yaratildi» (operator-buyurtma-formasi 20-kadr): «Natija va buyurtma» paneli o'rnida — buyurtma, tovar,
 * summa, manzil, ombor, jo'natish kuni va mijozga SMS. Qiymatlar tasdiq paytidagi server javobidan.
 */
export function OrderDoneCard({ done }: { done: OrderDone }) {
  const { t } = useTranslation();
  const { card, price, quantity, result, at } = done;
  const address = card.address;
  const ship = shipDay(at);
  const left = result.stockAvailable ?? (done.available != null ? done.available - quantity : null);
  const fee = price ? (price.deliveryFee === 0 ? t('opo.free') : formatMoney(price.deliveryFee)) : null;

  return (
    <div className={styles.done} data-testid="order-done">
      <div className={styles.doneHead}>
        <span className={styles.doneIcon} aria-hidden><CircleCheck /></span>
        <div>
          <h2 className={styles.title}>{t('opo.doneTitle')}</h2>
          <p className={styles.note}>{t('opo.doneSub', { time: clock(at) })}</p>
        </div>
      </div>
      <dl className={styles.doneList}>
        <dt>{t('opo.doneOrder')}</dt>
        <dd><span className={styles.doneOrder}><strong>{card.id}</strong><StatusBadge family="lead" code={result.status} /></span></dd>
        <dt>{t('opo.doneGoods')}</dt>
        <dd>{t('opo.doneGoodsValue', { name: card.product.name, qty: quantity })}</dd>
        {price ? (
          <>
            <dt>{t('opo.doneSum')}</dt>
            <dd><span className={styles.num}>{`${formatMoney(price.subtotal)} + ${fee} = ${sum(price.totalAmount)}`}</span></dd>
          </>
        ) : null}
        {address ? (
          <>
            <dt>{t('opo.doneAddress')}</dt>
            <dd>{`${address.regionName}, ${address.districtName}, ${address.addressLine} · ${t(`opw.whereDeliver.${address.whereDeliver}` as TranslationKey)}`}</dd>
          </>
        ) : null}
        <dt>{t('opo.doneStock')}</dt>
        <dd>{left !== null ? t('opo.doneStockValue', { name: card.product.name, count: left }) : t('opo.doneStockReserved', { name: card.product.name })}</dd>
        <dt>{t('opo.doneShip')}</dt>
        <dd>{t(ship.today ? 'opo.today' : 'opo.tomorrow', { date: dayLabel(`${ship.date}T12:00:00+05:00`) })}</dd>
        <dt>{t('opo.doneCustomer')}</dt>
        <dd>{t('opo.doneSms')}</dd>
      </dl>
      <p className={styles.note}>{t('opo.doneCancel')}</p>
    </div>
  );
}
