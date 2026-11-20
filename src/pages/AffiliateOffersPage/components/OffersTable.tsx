import { ArrowDown, CircleMinus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AffiliateOffer, OfferSort } from '../../../features/affiliate/api/offersApi';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { CreateState } from '../model/createState';
import { CreateButton, CreateError, OfferPhoto } from './OfferCard';
import styles from '../AffiliateOffersPage.module.css';

interface OffersTableProps {
  offers: readonly AffiliateOffer[];
  sort: OfferSort;
  onSort: (sort: OfferSort) => void;
  states: Readonly<Record<string, CreateState>>;
  onCreate: (offer: AffiliateOffer) => void;
  asOf: string | null;
}

/** Ustun sarlavhasidan saralash (pastga strelka — shu ustun bo'yicha, kattasidan). */
function SortHeader({ label, value, sort, onSort }: { label: string; value: OfferSort; sort: OfferSort; onSort: (sort: OfferSort) => void }) {
  const active = sort === value;
  return (
    <th className={styles.num} aria-sort={active ? 'descending' : 'none'}>
      <button type="button" className={styles.sortButton} data-active={active || undefined} onClick={() => onSort(value)}>
        {label}
        {active ? <ArrowDown aria-hidden /> : null}
      </button>
    </th>
  );
}

/** «Jadval» ko'rinishi (sotuvchi-offerlar 3): offerlarni solishtirish; «Sahifa yaratish» har qatorda. */
export function OffersTable({ offers, sort, onSort, states, onCreate, asOf }: OffersTableProps) {
  const { t } = useTranslation();
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  return (
    <section className={styles.tableCard} aria-label={t('offers.view.table')}>
      <div className={styles.tableScroll}>
        <table className={styles.table} data-testid="offers-table">
          <thead>
            <tr>
              <th className={styles.sticky}>{t('offers.col.offer')}</th>
              <th className={styles.num}>{t('offers.col.price')}</th>
              <SortHeader label={t('offers.col.fee')} value="FEE" sort={sort} onSort={onSort} />
              <SortHeader label={t('offers.col.epc')} value="EPC" sort={sort} onSort={onSort} />
              <SortHeader label={t('offers.col.approve')} value="APPROVE_RATE" sort={sort} onSort={onSort} />
              <th className={styles.num}>{t('offers.col.sale')}</th>
              <th className={styles.num}>{t('offers.col.stock')}</th>
              <th aria-label={t('offers.create')} />
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => {
              const hasStats = offer.epc !== null || offer.approveRate !== null || offer.saleRate !== null;
              return (
                <tr key={offer.productId}>
                  <td className={styles.sticky}>
                    <span className={styles.offerCell}>
                      <OfferPhoto offer={offer} className={styles.thumb} />
                      <span className={styles.offerName}>
                        <Link to={`/affiliate/offers/${offer.productId}`}>{offer.name}</Link>
                        {offer.categoryName ? <span>{offer.categoryName}</span> : null}
                      </span>
                    </span>
                  </td>
                  <td className={styles.num}>
                    <span className={styles.stack}>
                      <span className={styles.strong}>{sum(offer.approvedPrice)}</span>
                      {offer.centerDeliveryFee ? <span className={styles.muted}>{t('offers.deliveryShort', { amount: formatMoney(offer.centerDeliveryFee) })}</span> : null}
                    </span>
                  </td>
                  <td className={styles.num}><strong>{sum(offer.affiliateFee)}</strong></td>
                  {hasStats ? (
                    <>
                      <td className={styles.num}>{offer.epc === null ? '—' : sum(offer.epc)}</td>
                      <td className={styles.num}>{offer.approveRate === null ? '—' : `${offer.approveRate}%`}</td>
                      <td className={styles.num}>{offer.saleRate === null ? '—' : `${offer.saleRate}%`}</td>
                    </>
                  ) : (
                    <td colSpan={3} className={`${styles.num} ${styles.muted}`}>{t('offers.noStats')}</td>
                  )}
                  <td className={styles.num}>
                    <span className={styles.stack}>
                      <span>{t('offers.stockCount', { count: formatMoney(Math.max(offer.stock, 0)) })}</span>
                      {offer.stock <= 0 ? (
                        <span className={styles.stockChip}>
                          <CircleMinus aria-hidden />
                          {t('offers.outOfStock')}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={styles.num}>
                    <CreateButton offer={offer} primary={false} state={states[offer.productId]} onCreate={() => onCreate(offer)} size="sm" />
                    <CreateError state={states[offer.productId]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.tableNote}>{t('offers.tableNote', { time: asOf ?? '—' })}</p>
    </section>
  );
}
