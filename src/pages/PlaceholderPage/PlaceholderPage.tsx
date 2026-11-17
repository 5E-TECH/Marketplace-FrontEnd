import { Clock } from 'lucide-react';
import { useTranslation } from '../../shared/i18n/useTranslation';
import styles from './PlaceholderPage.module.css';

/**
 * Menyu bandi bor, sahifasi hali qurilmagan (FE-01). Sarlavha yuqori qatorda —
 * marshrut nomi. O'z kartasi kelganda manifestdagi `load` almashtiriladi.
 */
export default function PlaceholderPage() {
  const { t } = useTranslation();
  return (
    <section className={styles.empty} data-testid="placeholder-page">
      <span className={styles.icon} aria-hidden><Clock /></span>
      <h2 className={styles.title}>{t('placeholder.title')}</h2>
      <p className={styles.text}>{t('placeholder.description')}</p>
    </section>
  );
}
