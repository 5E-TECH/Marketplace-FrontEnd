import { FileText, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLegalDocumentQuery } from '../../../features/sellerAuth/api/useLegalDocumentQuery';
import type { SellerProfile } from '../../../features/sellerProfile/api/sellerProfileApi';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from '../AffiliateHomePage.module.css';

interface HomeBannersProps {
  profile: SellerProfile | undefined;
  /** «Birinchi qadamlar» ko'rinmoqda — JShShIR u yerda 4-qadam, banner takrorlanmaydi. */
  onboarding: boolean;
}

/**
 * Sahifa ustidagi bannerlar (karkas-E 1.11, sotuvchi-bosh 3-bo'lim): `main` ning birinchi bloki,
 * `role="status"`, bir nechta bo'lsa — eng muhimi tepada. Oferta yangi versiyasi, keyin JShShIR.
 */
export function HomeBanners({ profile, onboarding }: HomeBannersProps) {
  const { t } = useTranslation();
  const offer = useLegalDocumentQuery('affiliate-offer');
  if (!profile) return null;

  const accepted = profile.agreements.find((item) => item.type === 'affiliate-offer' && item.current);
  const newOffer = offer.data && accepted && offer.data.version !== accepted.version ? offer.data.version : null;
  const selfEmployedPending = !onboarding && profile.selfEmployed.status !== 'VERIFIED';

  if (!newOffer && !selfEmployedPending) return null;
  return (
    <div className={styles.banners}>
      {newOffer ? (
        <div className={styles.banner} data-tone="info" role="status">
          <FileText aria-hidden />
          <div>
            <strong>{t('sellerHome.offerBannerTitle')}</strong>
            <p>{t('sellerHome.offerBannerText', { version: t('register.version', { version: newOffer }) })}</p>
          </div>
          <Link to="/profile/offer" className={styles.bannerAction}>{t('sellerHome.offerBannerAction')}</Link>
        </div>
      ) : null}
      {selfEmployedPending ? (
        <div className={styles.banner} data-tone="warning" role="status">
          <ShieldAlert aria-hidden />
          <div>
            <strong>{t('sellerHome.selfEmployedBannerTitle')}</strong>
            <p>{t('sellerHome.selfEmployedBannerText')}</p>
          </div>
          <Link to="/profile/self-employed" className={styles.bannerAction}>{t('sellerHome.selfEmployedBannerAction')}</Link>
        </div>
      ) : null}
    </div>
  );
}
