import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { useAffiliateBalanceQuery } from '../api/affiliateApi';
import styles from './BalancePocket.module.css';

/** Menyu ostidagi cho'ntak (karkas-E 1.5, sotuvchi-bosh): «Mavjud 692 500 so‘m · Balans ›». Faqat desktop menyusida. */
export function BalancePocket() {
  const { t } = useTranslation();
  const balance = useAffiliateBalanceQuery();
  if (!balance.data) return null;
  const { available } = balance.data;
  const amount = available < 0 ? `−${formatMoney(-available)}` : formatMoney(available);
  return (
    <div className={styles.slot}>
      <div className={styles.pocket} data-testid="balance-pocket">
        <span className={styles.label}>{t('sellerHome.available')}</span>
        <span className={styles.value}>{t('affiliateHome.sum', { amount })}</span>
        <Link to="/affiliate/balance" className={styles.link}>
          {t('nav.balance')}
          <ChevronRight aria-hidden />
        </Link>
      </div>
    </div>
  );
}
