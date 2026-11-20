import { ChartColumn } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './Chart.module.css';

/** «Statistika hali yo‘q» (komponentlar-E §23, v1 §13). */
export function ChartEmpty({ title, text }: { title?: string; text?: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden><ChartColumn /></span>
      <p className={styles.emptyTitle}>{title ?? t('chart.empty')}</p>
      {text ? <p className={styles.emptyText}>{text}</p> : null}
    </div>
  );
}

/** Skelet ustunlar balandligi, px (dizayndagidek). */
const SKELETON = [90, 60, 110, 80, 120, 70, 40];

/** Yuklanish: «Yuklanmoqda…» va skelet ustunlar. */
export function ChartLoading() {
  const { t } = useTranslation();
  return (
    <div className={styles.loading}>
      <p className={styles.loadingStatus} role="status">
        <span className={styles.spinner} aria-hidden />
        {t('chart.loading')}
      </p>
      <div className={styles.skeleton} aria-hidden>
        {SKELETON.map((height, index) => <span key={index} style={{ height }} />)}
      </div>
    </div>
  );
}
