import type { ReactNode } from 'react';
import { BRAND } from '../../config/brand';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { LanguageSwitcher } from '../LanguageSwitcher/LanguageSwitcher';
import styles from './AuthLayout.module.css';

const BRAND_ICON = '/brand/elchi-app-icon.png';

interface AuthLayoutProps {
  /**
   * Yon blok: desktop'da chapdagi navy ustun (`brand` bilan), telefonda forma
   * ostidagi och blok (umumiy-kirish, sotuvchi-royxat).
   */
  renderAside: (tone: 'navy' | 'light', brand: ReactNode) => ReactNode;
  children: ReactNode;
}

/** Kirish va ro'yxat sahifalari karkasi: navy ustun + markazdagi 400 px forma. */
export function AuthLayout({ renderAside, children }: AuthLayoutProps) {
  // Telefon va planshet (< 1024): tepada navy qator (56 / 64 px), forma, ostida och blok — .mobil, .planshet.
  const compact = useMediaQuery('(max-width: 1023.98px)');
  const phone = useMediaQuery('(max-width: 767.98px)');

  if (compact) {
    return (
      <div className={`${styles.phonePage} ${phone ? '' : styles.tabletPage}`.trim()} data-auth-layout={phone ? 'phone' : 'tablet'}>
        <header className={styles.phoneHeader}>
          <span className={styles.brand}>
            <img src={BRAND_ICON} alt="" width={32} height={32} />
            <span>{BRAND.name}</span>
          </span>
          <LanguageSwitcher className={styles.navyLanguage} />
        </header>
        <main className={styles.phoneMain}>{children}</main>
        {renderAside('light', null)}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {renderAside(
        'navy',
        <span className={`${styles.brand} ${styles.asideBrand}`}>
          <img src={BRAND_ICON} alt="" width={36} height={36} />
          <span>{BRAND.name}</span>
        </span>,
      )}
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <LanguageSwitcher />
        </div>
        <div className={styles.center}>{children}</div>
      </main>
    </div>
  );
}
