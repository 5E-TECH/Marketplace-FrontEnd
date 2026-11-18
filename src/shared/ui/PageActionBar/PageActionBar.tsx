import type { ReactNode } from 'react';
import { usePhoneActionBar } from './usePhoneActionBar';
import styles from './PageActionBar.module.css';

/**
 * Pastki amal paneli (karkas-E 4.4): faqat telefonda — sahifaning asosiy amali pastda, to‘liq
 * kenglikda; ikkinchi amal chapda oq tugma. Desktop va planshetda hech narsa chizmaydi —
 * sahifa tugmalarni o‘z joyida ko‘rsatadi (`usePhoneActionBar`).
 */
export function PageActionBar({ children }: { children: ReactNode }) {
  const phone = usePhoneActionBar();
  return phone ? <div className={styles.bar}>{children}</div> : null;
}
