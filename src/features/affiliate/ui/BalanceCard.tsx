import { ChevronRight, CircleCheck, CreditCard, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAffiliateBalanceQuery } from '../api/affiliateApi';
import { MIN_PAYOUT } from '../model/affiliateBalance';
import type { SellerProfile } from '../../sellerProfile/api/sellerProfileApi';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import styles from './BalanceCard.module.css';

const BALANCE_PATH = '/affiliate/balance';
const CARD_BRAND: Record<'UZCARD' | 'HUMO', string> = { UZCARD: 'Uzcard', HUMO: 'Humo' };

/** Manfiy summa — U+2212 bilan (content-spec 0.3). */
const signedMoney = (value: number) => (value < 0 ? `−${formatMoney(-value)}` : formatMoney(value));

/** Nega pul yechib bo'lmaydi (sotuvchi-bosh holatlari: yangi sotuvchi, JShShIR, manfiy balans). */
function payoutBlock(profile: SellerProfile | undefined, available: number): TranslationKey | null {
  if (!profile) return null;
  const verified = profile.selfEmployed.status === 'VERIFIED';
  if (!verified && !profile.card) return 'sellerHome.payoutNeedsAll';
  if (!verified) return 'sellerHome.payoutNeedsSelfEmployed';
  if (!profile.card) return 'sellerHome.payoutNeedsCard';
  if (available < MIN_PAYOUT) return 'sellerHome.payoutBelowMin';
  return null;
}

/**
 * «Mavjud» kartasi (sotuvchi-bosh 1-qator o'ngda): summa va «Pul yechish», mavjud / ushlab turilgan
 * chizig'i, qoidalar; to'lovga tayyor bo'lsa — karta, JShShIR belgisi va «Balans ›». Yechish ekrani — FE-07.
 */
export function BalanceCard({ profile }: { profile: SellerProfile | undefined }) {
  const { t } = useTranslation();
  const balance = useAffiliateBalanceQuery();
  const sum = (value: number) => t('affiliateHome.sum', { amount: signedMoney(value) });

  if (balance.isError && !balance.data) {
    return (
      <section className={`${styles.card} ${styles.balance}`} aria-label={t('sellerHome.balanceLabel')}>
        <LoadError error={balance.error} onRetry={() => void balance.refetch()} />
      </section>
    );
  }

  const data = balance.data;
  const block = data ? payoutBlock(profile, data.available) : null;
  const disabled = !data || !profile || block !== null;
  const ready = profile?.card && profile.selfEmployed.status === 'VERIFIED';

  return (
    <section className={`${styles.card} ${styles.balance}`} aria-label={t('sellerHome.balanceLabel')} data-testid="balance-card">
      <div className={styles.balanceTop}>
        <div className={styles.balanceAmount}>
          <span className={styles.kpiLabel}>{t('sellerHome.available')}</span>
          {data ? (
            <strong className={styles.balanceValue} data-negative={data.available < 0 || undefined}>{sum(data.available)}</strong>
          ) : (
            <span className={styles.skeleton} aria-label={t('sellerHome.loading')} />
          )}
        </div>
        {disabled ? (
          <button type="button" className={styles.withdraw} disabled>{t('sellerHome.withdraw')}</button>
        ) : (
          <Link to={BALANCE_PATH} className={styles.withdraw}>{t('sellerHome.withdraw')}</Link>
        )}
      </div>
      {data ? (
        <>
          <div
            className={styles.balanceBar}
            role="img"
            aria-label={t('sellerHome.balanceBar', { available: sum(data.available), held: sum(data.held) })}
          >
            {data.available > 0 ? <span style={{ flexGrow: data.available }} data-part="available" /> : null}
            {data.held > 0 ? <span style={{ flexGrow: data.held }} data-part="held" /> : null}
          </div>
          <ul className={styles.balanceLegend}>
            <li>
              <span className={styles.swatch} data-part="available" aria-hidden />
              <span className={styles.strong}>{t('sellerHome.available')}</span>
            </li>
            <li className={styles.balanceLegendWide}>
              <span className={styles.swatch} data-part="held" aria-hidden />
              <span>
                <span className={styles.strong}>{t('sellerHome.hold')} <span className={styles.nums}>{sum(data.held)}</span></span>{' '}
                <span className={styles.secondary}>{t('sellerHome.holdHint')}</span>
              </span>
            </li>
          </ul>
        </>
      ) : null}
      {block ? (
        <p className={styles.payoutBlock}>
          <Lock size={14} aria-hidden />
          <span>{t(block)}</span>
        </p>
      ) : null}
      <p className={styles.payoutRules}>{t('sellerHome.payoutRules')}</p>
      {ready && profile.card ? (
        <div className={styles.balanceFoot}>
          <span className={styles.balanceCardNo}>
            <CreditCard size={16} aria-hidden />
            {CARD_BRAND[profile.card.brand]} ···· {profile.card.last4}
          </span>
          <span className={styles.chip} data-tone="success">
            <CircleCheck size={14} aria-hidden />
            {t('sellerHome.selfEmployedVerified')}
          </span>
          <Link to={BALANCE_PATH} className={styles.balanceLink}>
            {t('nav.balance')}
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
