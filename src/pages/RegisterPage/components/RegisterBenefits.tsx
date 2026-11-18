import { CreditCard, Headset, Package, Truck, Wallet, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from '../RegisterPage.module.css';

const BENEFITS: ReadonlyArray<{ icon: LucideIcon; title: TranslationKey; text: TranslationKey }> = [
  { icon: Package, title: 'register.benefit1Title', text: 'register.benefit1Text' },
  { icon: Headset, title: 'register.benefit2Title', text: 'register.benefit2Text' },
  { icon: Truck, title: 'register.benefit3Title', text: 'register.benefit3Text' },
  { icon: Wallet, title: 'register.benefit4Title', text: 'register.benefit4Text' },
  { icon: CreditCard, title: 'register.benefit5Title', text: 'register.benefit5Text' },
];

/** «Siz reklama qilasiz — qolganini platforma bajaradi» (sotuvchi-royxat): desktopda navy, telefonda forma ostida. */
export function RegisterBenefits({ tone, brand }: { tone: 'navy' | 'light'; brand: ReactNode }) {
  const { t } = useTranslation();
  return (
    <aside className={tone === 'navy' ? styles.benefitsNavy : styles.benefitsLight} aria-labelledby="register-benefits">
      {brand}
      <div className={styles.benefitsBody}>
        <h2 id="register-benefits" className={styles.benefitsTitle}>{t('register.benefitsTitle')}</h2>
        <ul className={styles.benefitList}>
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className={styles.benefit}>
              <span className={styles.benefitIcon} aria-hidden><Icon size={18} /></span>
              <span className={styles.benefitText}>
                <span className={styles.benefitTitle}>{t(title)}</span>
                <span className={styles.benefitDescription}>{t(text)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.benefitsNote}>{t('register.benefitsNote')}</p>
    </aside>
  );
}
